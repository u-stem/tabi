# Google Maps 統合設計

Date: 2026-03-03

## 概要

旅程ページに Google Maps を統合し、2 つの機能を追加する。

1. **Places Autocomplete** — スポット追加フォームで場所を検索すると名前・住所・座標が自動入力される
2. **Map View + 移動情報** — 右パネルの地図タブで当日／全期間のスポットをピン表示し、ルート線と所要時間をタイムラインに表示する

## ゴール

- スポット登録時の住所入力を Places API で補完し、lat/lng を自動取得する
- 右パネルの地図タブでスポットのピンとルート線を表示する
- タイムラインのスポット間セパレータに移動所要時間を表示する（`transport` カテゴリ以外の連続スポット間のみ）

## 対象外

- 既存スポットの一括ジオコーディング（座標のない既存データはピン非表示）
- ターンバイターンのナビゲーション
- 飛行機（airplane）の所要時間計算（Routes API が非対応のため表示スキップ）
- モバイル（right panel は lg 以上のみ表示する現行仕様を維持）

---

## アクセス制御（maps_enabled フラグ）

### 方針

Maps 機能は初期リリース時、管理者が作成した旅行に限定する。

- 管理者が作成した旅行 → `maps_enabled = true`（自動設定）
- 一般ユーザーが作成した旅行 → `maps_enabled = false`
- 一般ユーザーも `maps_enabled = true` の旅行に参加していれば Maps 機能を使える

管理者は `ADMIN_USERNAME` 環境変数で識別する（既存の `requireAdmin` ミドルウェアと同じ仕組み）。

### trips テーブルへの追加カラム

```sql
maps_enabled  BOOLEAN  NOT NULL  DEFAULT false
```

### 自動設定ロジック（旅行作成時）

`POST /api/trips` のハンドラー内で、作成者が管理者かどうかを判定して `mapsEnabled` を設定する:

```ts
const isAdmin = user.username === process.env.ADMIN_USERNAME
const trip = await db.insert(trips).values({
  ...values,
  ownerId: user.id,
  mapsEnabled: isAdmin,
})
```

### API レスポンスへの追加

`GET /api/trips/:tripId` のレスポンスに `mapsEnabled: boolean` を追加し、フロントエンドに公開する。

### フロントエンドの制御

旅程ページ（`trips/[id]/page.tsx`）で `trip.mapsEnabled` を確認し、false の場合は以下をすべて非表示・無効化する:

| 機能 | 制御方法 |
|------|---------|
| `<APIProvider>` のレンダリング | `mapsEnabled` が false なら unmount（Maps JS をロードしない） |
| 地図タブ（右パネル） | `mapsEnabled` が false なら `RightPanelTab` に `"map"` を含めない |
| Places Autocomplete | `mapsEnabled` が false なら通常の text input にフォールバック |
| `TravelTimeSeparator` | `mapsEnabled` が false なら何も表示しない |
| キーボードショートカット `g m` | `mapsEnabled` が false なら登録しない |

### `/api/directions` エンドポイントのアクセス制御

directions プロキシに `tripId` パラメータを追加し、その旅行の `mapsEnabled` を検証する:

```
GET /api/directions?tripId=...&originLat=...&originLng=...&destLat=...&destLng=...
```

- `requireAuth` でユーザー認証を確認
- `checkTripAccess(tripId, userId)` で旅行への参加を確認
- `trip.mapsEnabled` が false なら 403 を返す

これにより、Maps 機能を無効化された旅行から directions API を直接叩いても拒否される。

### 型定義（`packages/shared/src/types.ts`）

`TripResponse` 型（レスポンス型は Zod スキーマではなく TypeScript 型で定義されている）に追加:

```ts
mapsEnabled: boolean
```

---

## 使用する Google APIs

| API | 用途 | 料金（月 $200 無料クレジット後） |
|-----|------|-----------------------------|
| Places API (New) | Autocomplete + Place Details | $0.017/セッション |
| Routes API | 所要時間 + ルートポリライン | $0.005/要素 |
| Maps JavaScript API | 地図の描画 | $7/1000 ロード |

旅行アプリのスケールでは月 $200 の無料クレジット範囲内に収まる。

### 環境変数（2 つ必要）

| 変数名 | 用途 | キーの制限設定 |
|--------|------|--------------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JS API + Places API（フロントエンド） | HTTP リファラー制限（自ドメインのみ） |
| `GOOGLE_MAPS_API_KEY` | Routes API（サーバーサイドプロキシ） | 制限なし（Vercel の出口 IP が固定されないため IP 制限は使えない） |

Vercel の Environment Variables に両方追加する。

---

## データモデル

### trips テーブルへの追加カラム

```sql
maps_enabled  BOOLEAN  NOT NULL  DEFAULT false
```

### schedules テーブルへの追加カラム

```sql
latitude   DOUBLE PRECISION  -- nullable
longitude  DOUBLE PRECISION  -- nullable
place_id   VARCHAR(255)      -- nullable（Google Place ID）
```

- 既存の `address` カラムはそのまま残す。Places 選択時は `formattedAddress` で上書きする
- `latitude / longitude` が null のスポットは地図にピンを出さない、所要時間計算もスキップする
- DB migration（trips + schedules 両テーブル分を 1 ファイルにまとめる）: `bun run db:generate` → `bun run db:migrate`

### 型定義（`packages/shared/src/types.ts`）

`TripResponse` 型に追加（レスポンス型は TypeScript 型で定義、`tripSchema` は存在しない）:

```ts
mapsEnabled: boolean
```

`ScheduleResponse` 型に追加:

```ts
latitude?: number | null
longitude?: number | null
placeId?: string | null
```

### Zod スキーマ（`packages/shared/src/schemas/schedule.ts`）

`createScheduleSchema` に追加（`updateScheduleSchema` は `.partial()` 派生のため不要）:

```ts
latitude:  z.number().nullable().optional()
longitude: z.number().nullable().optional()
placeId:   z.string().max(255).nullable().optional()
```

---

## Places Autocomplete

### 変更ファイル

- `apps/web/components/schedule-form-fields.tsx` — address フィールドを Autocomplete に差し替え。選択時に親へコールバックで lat/lng/placeId を通知する
- `apps/web/components/add-schedule-dialog.tsx` — `onLocationSelected` コールバックを受け取り、lat/lng/placeId をフォーム state に保持する
- `apps/web/components/edit-schedule-dialog.tsx` — 同上
- `apps/web/app/(authenticated)/trips/[id]/layout.tsx` — `<APIProvider>` をここに配置（旅程ページのスコープに限定）

### 動作フロー

```
ユーザーが address フィールドに入力
→ Places Autocomplete がドロップダウン表示
→ 候補を選択すると onLocationSelected コールバックを呼び出す:
    address   ← place.formattedAddress
    latitude  ← place.location.lat()
    longitude ← place.location.lng()
    place_id  ← place.id
    name      ← place.displayName（name フィールドが空の場合のみ上書き）
```

手入力した場合は lat/lng を null のまま保存する。

### ScheduleFormFieldsProps への追加

```ts
onLocationSelected?: (params: {
  address: string
  latitude: number
  longitude: number
  placeId: string
  name: string
}) => void
```

### APIProvider の配置

旅程ページのレイアウト（`apps/web/app/(authenticated)/trips/[id]/layout.tsx`）に配置し、**ルートレイアウトには置かない**。これにより Maps JS API のロードが旅程ページのみに限定され、他ページでのコスト発生を防ぐ。

```tsx
<APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
  {children}
</APIProvider>
```

ライブラリ: `@vis.gl/react-google-maps`（vis.gl チームが管理するオープンソース、Google が資金提供）

---

## Map View（右パネルの地図タブ）

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `right-panel-tabs.tsx` | `RightPanelTab` 型に `"map"` 追加、地図アイコンのタブを追加 |
| `right-panel.tsx` | `map` タブ用のコンテナスタイルを分岐、`MapPanel` をレンダリング。全スケジュールデータを props で受け取る |
| `map-panel.tsx`（新規） | Google Maps 表示コンポーネント |

キーボードショートカット: 既存の `g <key>` パターンに合わせて `g m` を追加。

### RightPanel への props 追加

全期間モードに trip 全体の schedules が必要なため、`RightPanel` に追加:

```ts
allSchedules: Schedule[]  // trip 全スポット（全日程分）
```

### MapPanel 仕様

```
MapPanel
├─ 表示切替: [当日] [全期間]
├─ GoogleMap
│   ├─ 当日モード: 選択中の dayPattern の schedules（lat/lng があるものだけ）
│   │   ├─ AdvancedMarkerElement でスポットをピン表示
│   │   ├─ 連続する非 transport スポット間にルートポリライン
│   │   └─ ピンクリック → InfoWindow でスポット名を表示
│   └─ 全期間モード: trip 全スポット（日ごとに色分け、ルート線なし）
│       色: 10色のパレットを日付インデックスで割り当て、日数が超えた場合は循環
└─ lat/lng がないスポットはピンを出さない
```

### レイアウト（right-panel.tsx の構造変更）

現在の共通コンテナ（`overflow-y-auto p-4`）は地図描画を妨げる。タブごとにコンテナスタイルを分岐させる:

```tsx
// 地図タブ以外
<div className="min-h-0 overflow-y-auto overscroll-contain p-4">
  {/* 各タブのコンテンツ */}
</div>

// 地図タブ
<div className="min-h-0 overflow-hidden">
  <MapPanel ... />
</div>
```

右パネル外側のスタイル（`max-h-[calc(100vh-12rem)]`、`sticky top-4`）は変更しない。

### オフライン（PWA）対応

地図タブは Google Maps JS の読み込みが必要なため、オフライン時は地図タブのコンテンツをエラー表示（「オフライン時は地図を表示できません」）に差し替える。既存の `online` フラグを `MapPanel` に渡して制御する。

---

## タイムライン — 所要時間セパレータ

### 表示条件

以下をすべて満たすスポットの連続ペアにのみ表示する:

- 同一 dayPattern 内で連続している
- 両スポットのカテゴリが `transport` 以外
- 両スポットに lat/lng がある
- 両スポットに `startTime` / `endTime` がある（時刻不明のスポット間には表示しない）
- 前スポットの `endDayOffset` が 0（複数日スパンのスポットはスキップ）

### 表示形式

```
[ spot A  09:00-10:00 ]
  ---- 車で 15分 → ----
[ spot B  10:15-12:00 ]
```

### データ取得

- Routes API（`computeRoutes`）を使用
- デフォルト移動手段: `DRIVING`
- **API キーをクライアントに露出させないためサーバーサイドプロキシ経由**（`GOOGLE_MAPS_API_KEY` を使用）
- プロキシエンドポイント: `GET /api/directions?tripId=...&originLat=...&originLng=...&destLat=...&destLng=...&originPlaceId=...&destPlaceId=...`
- レスポンス: `{ durationSeconds: number, polyline: string }`
- 認証: `requireAuth` 必須、`checkTripAccess` で旅行参加確認、`trip.mapsEnabled` が false なら 403

### キャッシュ

- React Query で以下をキーにキャッシュ:
  - `placeId` がある場合: `["directions", originPlaceId, destPlaceId, "DRIVING"]`
  - `placeId` がない場合（手入力住所）: `["directions", originLat, originLng, destLat, destLng, "DRIVING"]`
- `staleTime: 5分`

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/components/day-timeline.tsx` | 表示条件を満たすペアの間に `TravelTimeSeparator` を挿入 |
| `apps/web/components/travel-time-separator.tsx`（新規） | 所要時間表示コンポーネント |
| `apps/api/src/routes/directions.ts`（新規） | Routes API プロキシ（`requireAuth` 必須） |
| `apps/web/app/api/[[...route]]/route.ts` | directions ルートを追加 |

---

## 実装順序

1. DB migration（`trips.maps_enabled` + schedules の lat/lng/place_id を 1 ファイルにまとめて生成）
2. Zod スキーマ更新（`tripSchema` に `mapsEnabled`、`scheduleSchema` に lat/lng/placeId）
3. `POST /api/trips` で管理者判定 → `mapsEnabled` 自動設定。`GET /api/trips/:tripId` レスポンスに `mapsEnabled` を追加
4. `@vis.gl/react-google-maps` パッケージ追加。`APIProvider` を旅程ページレイアウトに配置（`mapsEnabled` が true の場合のみレンダリング）
5. `ScheduleFormFieldsProps` に `onLocationSelected` コールバックを追加し、`add-schedule-dialog.tsx` / `edit-schedule-dialog.tsx` を更新
6. Places Autocomplete を `schedule-form-fields.tsx` に統合（`mapsEnabled` が false なら通常の text input）
7. Routes API プロキシエンドポイント作成（`requireAuth` + `checkTripAccess` + `mapsEnabled` チェック付き）
8. `RightPanel` に `allSchedules` / `mapsEnabled` props を追加し、コンテナ構造を地図タブ用に分岐
9. `MapPanel` コンポーネント作成（ピン + ルートポリライン + オフライン対応）
10. 右パネルに地図タブ追加（`mapsEnabled` が true の場合のみ表示、キーボードショートカット `g m` を含む）
11. `TravelTimeSeparator` を `day-timeline.tsx` に統合（`mapsEnabled` が false なら非表示）
12. テスト・FAQ 更新

---

## テスト方針

- `POST /api/trips`: 管理者が作成すると `mapsEnabled = true`、一般ユーザーは `false` になること（ユニットテスト）
- `GET /api/directions`: `mapsEnabled = false` の旅行に対して 403 を返すこと（ユニットテスト）
- Places Autocomplete 選択時に `onLocationSelected` が呼ばれ、親の state に lat/lng が反映されること（ユニットテスト）
- `mapsEnabled = false` の旅行では地図タブ・Autocomplete・TravelTimeSeparator が描画されないこと（ユニットテスト）
- MapPanel: lat/lng null のスポットがピン対象から除外されること（ユニットテスト）
- TravelTimeSeparator: transport カテゴリ・時刻なし・endDayOffset > 0 のスポット前後に表示されないこと（ユニットテスト）
- E2E（Playwright）: Google Maps と Places API をモック化した上で、管理者作成の旅行でスポット追加 → 地図タブでピンが表示され、タイムラインに所要時間が表示されることを確認

---

## FAQ 更新（`apps/api/src/db/seed-faqs.ts`）

実装完了後に追加するエントリ:

- 地図タブが表示されない → 管理者が作成した旅行でのみ利用可能と案内
- 地図にスポットが表示されない → 住所を Places Autocomplete で選択するよう案内
- タイムラインに移動時間が表示されない → lat/lng があり時刻を設定した非 transport スポットが 2 つ以上必要と案内
- 地図タブの使い方（当日 / 全期間の切り替え）

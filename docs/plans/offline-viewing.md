# オフラインでの旅行閲覧

## 背景

旅行中に機内や地下鉄などオフライン環境でスケジュールを確認したい。現状は Service Worker のフォールバックで「オフラインです」メッセージが表示されるのみで、旅行データは閲覧できない。

## スコープ

### スコープ内

- React Query キャッシュの IndexedDB 永続化
- gcTime の延長とpersister maxAge の設定
- `/offline` ページの改善（キャッシュ済み旅行一覧の表示）

### 対象外

- オフラインでの編集・データ変更
- Service Worker でのAPIレスポンスキャッシュ
- 明示的な「オフライン保存」ボタン
- オフラインからオンライン復帰時の同期・衝突解決
- 画像のオフラインキャッシュ

## 設計

### 1. キャッシュ永続化

`@tanstack/react-query-persist-client` と `idb-keyval`（2KB の軽量 IndexedDB ラッパー）を使い、React Query のキャッシュを自動的に IndexedDB に永続化する。

**仕組み:**

1. `idb-keyval` で IndexedDB にキャッシュを保存する persister を作成
2. `QueryProvider` で `PersistQueryClientProvider` に切り替え
3. React Query がキャッシュを更新するたびに自動的に IndexedDB に書き出す
4. ページリロード・アプリ再起動時に IndexedDB からキャッシュを復元

**gcTime の調整:**

現状 `dynamic` クエリの gcTime は60秒。オフライン閲覧のために24時間に延長する。staleTime はそのまま（オンライン時は常に最新を取得する挙動を維持）。

**maxAge:**

persister に maxAge を7日に設定。7日以上前のキャッシュは復元しない。

**対象データ:**

全ての React Query キャッシュが対象。旅行一覧、旅行詳細（スケジュール、候補）、費用、お土産、投票など、一度閲覧したデータは全てオフラインで閲覧可能になる。

### 2. オフラインページの改善

現状の `/offline` ページ（Service Worker のナビゲーションフォールバック）を改善する。

**現状:** Server Component。WifiOff アイコン + 「オフラインです」メッセージのみ。

**変更後:** Client Component に変更し、IndexedDB からキャッシュ済み旅行一覧を読み出して表示する。

- キャッシュ済みの旅行があればリンク一覧を表示。タップで旅行詳細ページに遷移（キャッシュから表示される）
- キャッシュが空なら従来通りのメッセージ

**既存の OfflineBanner（ヘッダー下の黄色バナー）は変更しない。**

## 用語

- persister: React Query のキャッシュを外部ストレージに読み書きするアダプター
- gcTime: ガベージコレクション時間。クエリが使われなくなってからキャッシュを保持する時間
- staleTime: キャッシュを「古い」と判定するまでの時間。古くなるとバックグラウンドで再取得する
- maxAge: persister がキャッシュを復元する際の有効期限

# SpSwipeTabs - SP版統一スワイプタブコンポーネント設計

## 目的

SP版の5ページに分散しているタブ+スワイプの実装を、1つの `SpSwipeTabs` コンポーネントに統合する。ネイティブアプリに近い操作感を実現し、挙動の一貫性を保証する。

## 現状の問題

- 同じパターン（タブバー + useSwipeTab + translateX + adjacent配置）を5ページで手動組み立て
- ページごとに微妙に異なる実装（tapAnimating vs tapTransitionRef、h-0 trick vs absolute配置）
- タブボタンの `transition-[colors,box-shadow] duration-200` がスワイプ後に不自然なハイライト遷移を起こす
- `active:scale` がネイティブアプリの標準から外れている
- タップ時の250msスライドアニメーションがネイティブの即座切り替えと異なる

## 設計

### コンポーネントAPI

```tsx
type SwipeTab<T extends string = string> = {
  id: T;
  label: string;
  badge?: number;
};

type SpSwipeTabsProps<T extends string = string> = {
  tabs: SwipeTab<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  renderContent: (tabId: T) => ReactNode;
  /** Content inserted between tab bar and swipe container (e.g. toolbar) */
  children?: ReactNode;
  /** Enable scroll position restoration per tab */
  preserveScroll?: boolean;
  /** External scroll container (e.g. SpScrollContainer). Used for scroll save/restore. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** When false, disable swipe gestures (e.g. loading state, guest mode) */
  swipeEnabled?: boolean;
  className?: string;
};
```

- `activeTab` / `onTabChange`: 外部制御。各ページが状態を持つ
- `renderContent`: タブIDに応じたコンテンツを返す関数
- `preserveScroll`: タブごとのスクロール位置を保存・復元する（opt-in）
- `scrollRef`: 外部スクロールコンテナ。`preserveScroll` 有効時のみ使用。未指定時は内部コンテナから scroll 位置を取得
- `swipeEnabled`: スワイプ有効/無効の外部制御（デフォルト: true）。ローディング中・ゲストモードなど、ページ側でのみ判断できる条件に対応
- ジェネリクス `T extends string` により、各ページ固有のタブID型（`MobileContentTab`, `HomeTab` 等）を型安全に使用可能

### タブバー

- セグメントコントロール風（角丸背景 + shadow-sm）。現在のスタイル維持
- `active:scale` なし、`transition` なし。即座に切り替え
- WAI-ARIA tabs: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `tabIndex` roving
- キーボード: ArrowLeft/Right, Home, End（全ページで統一）
- バッジ: `badge` が 1 以上のとき数字を表示。0 以下は非表示

### コンテンツ描画

- アクティブタブのみDOMに描画。スワイプ中は隣接タブも追加描画
- 隣接タブは `position: absolute; translateX(±100%)` で配置、`aria-hidden="true"`
- `useSwipeTab` の `adjacent` state が `"prev"` / `"next"` になったタイミングで React が隣接タブをマウント。hookの `moveSwipe` → `setAdjacent` は pointer/touch の最初の移動で発火するため、視覚的に隣接コンテンツが必要になる前（指がまだほぼ動いていない段階）にマウントが完了する。現在の home/friends/roulette ページで同じパターンが問題なく動作している
- 非アクティブタブはアンマウント。データは React Query キャッシュにあるため再取得不要

### タブ切り替え動作

- **タップ / キーボード**: 即座に切り替え。外側の base offset div は `transition: "none"` 固定
- **スワイプ**: `useSwipeTab` hookによる滑らかなアニメーション（250ms）。hook が `swipeContainerRef` を直接DOM操作するため、base offset の transition とは独立
- コンポーネント内部でタップ/スワイプを判別。外部APIからは `onTabChange(tabId)` のみ公開。`source: "tap"` のような区別は不要

### スクロール位置保存

`preserveScroll` 有効時のライフサイクル:

**タップ/キーボードによる切り替え:**
1. `onTabChange` ハンドラ内で、切り替え前に現在のスクロール位置を `scrollPositions` ref に保存
2. `activeTab` state を更新
3. `useLayoutEffect` で新タブのスクロール位置を復元（ペイント前）

**スワイプによる切り替え:**
1. `useSwipeTab` の `onSwipeComplete` コールバックは `flushSync` 内から呼ばれる
2. コンポーネントが `onSwipeComplete` を受け取る前に、現在のスクロール位置を保存（`onTabChange` を呼ぶ直前）
3. `onTabChange` → state 更新 → `useLayoutEffect` で復元

**スクロールコンテナの決定:**
- `scrollRef` 指定時: そのコンテナのスクロール位置を保存・復元
- 未指定時: コンポーネント内部の content container ref を使用

**注意: trips ページの translateY 補正ロジックについて**
現在の SP trips ページにはスワイプ中のスクロール位置差分を `translateY` で補正するロジックがある。このロジックは `SpSwipeTabs` のスコープ外とし、ページ側で必要に応じて `scrollRef` 経由のイベントハンドラで対応する。初期実装では補正なしとし、実際に問題が出たら追加する。

### DOM構造

```
<div>                          <!-- root -->
  <div role="tablist">         <!-- tab bar -->
    <button role="tab" />      <!-- tab triggers -->
  </div>
  <div ref={containerRef}>     <!-- swipe container (overflow-x-hidden) -->
    <div style={baseOffset}>   <!-- base translateX (tab index * -100%) -->
      <div ref={swipeRef}>     <!-- swipe target (hook controls transform) -->
        <div role="tabpanel">  <!-- active tab content -->
        <div role="tabpanel" aria-hidden="true" style="position:absolute">
                               <!-- adjacent tab (swipe only) -->
      </div>
    </div>
  </div>
</div>
```

### ユーティリティ関数

`getMobileTabTriggerId` / `getMobileTabPanelId` は `SpSwipeTabs` 内部に移動。authenticated ページのデスクトップレイアウトで ARIA 参照が必要な場合は、同関数を named export として公開する。

### ファイル構成

- `apps/web/components/sp-swipe-tabs.tsx` — 新規コンポーネント
- `apps/web/lib/__tests__/sp-swipe-tabs.test.tsx` — 新規テスト
- `apps/web/lib/hooks/use-swipe-tab.ts` — 変更なし（そのまま内部使用）

### テスト方針

新テストでカバーする項目:
- タブの描画: 全タブが `role="tab"` で表示されること
- アクティブ状態: `aria-selected`, `tabIndex`, スタイルクラス
- タップ切り替え: クリックで `onTabChange` が呼ばれること
- キーボード操作: ArrowLeft/Right, Home, End
- バッジ: 正数で表示、0で非表示
- ARIA連携: `aria-controls` と `tabpanel` の `id` が一致

スワイプ動作は `useSwipeTab` のpointer/touch イベントに依存するため、コンポーネント単体テストではカバーしない（hookの既存テストまたはE2Eで担保）。

### 置き換え対象

| ページ | 現在のタブ実装 | swipeEnabled の条件 |
|--------|---------------|-------------------|
| `(sp)/sp/trips/[id]/page.tsx` | MobileContentTabs + tapAnimating + h-0 trick | `!isLoading && !!trip` |
| `(sp)/sp/home/page.tsx` | inline buttons + absolute adjacent | `!isLoading && !error` |
| `(sp)/sp/friends/page.tsx` | inline buttons + absolute adjacent | `!isLoading && !isGuest` |
| `(sp)/sp/tools/roulette/page.tsx` | inline buttons + absolute adjacent | `true`（常時有効） |
| `(authenticated)/trips/[id]/page.tsx` | MobileContentTabs + tapTransitionRef + fade-in | `!isLoading && !!trip`（モバイルレイアウトのみ） |

### 削除されるもの

- `apps/web/components/mobile-content-tabs.tsx`（SpSwipeTabsに吸収）
- `apps/web/lib/__tests__/mobile-content-tabs.test.tsx`（新テストに置き換え）
- 各ページの `tapAnimating` / `tapTransitionRef` state
- 各ページのインラインタブボタン実装
- 各ページの translateX / adjacent / swipeContainerRef の手動配線

### 変更しないもの

- `useSwipeTab` hook
- デスクトップ版のレイアウト・アニメーション
- `settings/page.tsx`（デスクトップでサイドバーに変わるレスポンシブ設計のため除外。タブスタイルの `active:scale` 削除のみ本スコープに含める）
- `sp-bottom-nav.tsx` の `active:scale` 削除（本スコープに含める）

## スコープ外

- `useSwipeTab` hook 自体のリファクタリング
- デスクトップ版のタブUI変更
- settings ページのタブコンポーネント統合（レスポンシブサイドバーとの両立が必要なため除外）
- trips ページのスワイプ中 translateY スクロール補正（実際に問題が出たら別途対応）

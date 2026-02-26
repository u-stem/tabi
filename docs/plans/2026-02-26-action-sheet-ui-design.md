# ActionSheet UI 改善 設計

Date: 2026-02-26

## 問題

モバイル版の ActionSheet（下から出てくるメニュー）に以下の UX 問題がある。

1. **中央寄せ**: ボタン内のアイコン+テキストが中央揃えになっており、左寄せが一般的なモバイル UX と合っていない
2. **キャンセルのチグハグ**: アクションボタンはアイコン付きなのに、キャンセルボタンだけアイコンなし
3. **一部アクションのアイコン欠如**: `trip-toolbar.tsx` のステータスフィルタ・ソート選択がアイコンなしで ActionSheet に渡している

## 解決策

### 変更ファイル

**`apps/web/components/action-sheet.tsx`**

- アクションボタン・キャンセルボタンに `justify-start` を追加して左寄せ
- キャンセルボタンに `X` アイコン（lucide-react）を追加

**`apps/web/components/trip-toolbar.tsx`**

- ステータスフィルタ選択肢に `ListFilter` アイコンを追加
- ソート選択肢に `ArrowUpDown` アイコンを追加
- 各選択肢内でアイコンは共通（選択肢ごとに変えない）

## 変更範囲

- 変更ファイル: 2ファイル
- 型変更なし（`ActionSheetAction.icon` は引き続き optional）
- 呼び出し側への影響: `trip-toolbar.tsx` のみアイコン追加が必要

## 非採用案

**icon 必須化（Approach C）**: 型レベルでアイコンを必須にする案。理想的だが全呼び出し箇所の変更が必要で変更量に対する効果が小さいため見送り。

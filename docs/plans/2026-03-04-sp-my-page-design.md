# SP版マイページ → プロフィールページ設計

## Overview

SP版ボトムナビの「マイページ（ドロワー）」を「プロフィール（ページ遷移）」に変更し、
現在ドロワーに集約されていた設定導線・テーマ切替・ログアウトを新規ページに移動する。
FAQ等の「その他」コンテンツは設定ページの4つ目のタブに追加する。

## Changes

| File | Action |
|------|--------|
| `apps/web/app/(sp)/sp/my/page.tsx` | 新規作成（自分専用プロフィール+設定導線） |
| `apps/web/lib/view-mode.ts` | SP_ROUTES に `/my` を追加 |
| `apps/web/components/sp-bottom-nav.tsx` | マイページ button → Link(/sp/my)、SpUserMenuSheet 削除 |
| `apps/web/components/sp-user-menu-sheet.tsx` | 削除 |
| `apps/web/app/(authenticated)/settings/page.tsx` | 「その他」タブ追加 |
| `apps/web/app/(sp)/sp/settings/page.tsx` | SP専用設定ページに変更（4タブ対応） |

## `/sp/my` Page Design

```
┌──────────────────────────────────┐
│  [Avatar 64px]                   │
│  表示名                           │
│  @username                       │
├──────────────────────────────────┤
│  → 設定          (Settings icon) │
├──────────────────────────────────┤
│  テーマ  [ライト][ダーク][システム]  │
├──────────────────────────────────┤
│  PC版で表示                       │
│  アプリをインストール (if canInstall)│
│  フィードバック                    │
├──────────────────────────────────┤
│  [ログアウト]  (destructive)       │
└──────────────────────────────────┘
```

- ログアウトは既存の確認ドロワー付き（既存 SpUserMenuSheet のロジックを流用）
- テーマ切替は Check アイコン付きのボタン群（既存ドロワーと同じ UI）
- フィードバックは FeedbackDialog を開く
- PC版で表示は `switchViewMode("desktop")` を呼ぶ

## Settings Page "Other" Tab

現在3タブ（プロフィール/通知/アカウント）に4つ目を追加:
- `id: "other"`, `label: "その他"`, `Icon: MoreHorizontal`
- 内容: よくある質問 / お知らせ / フィードバック / 利用規約 / プライバシーポリシーのリンク一覧

### Mobile tab grid

`grid-cols-3` → `grid-cols-4`。
SP版はタブを icon + label で表示するとスペースが不足するため、
`apps/web/app/(sp)/sp/settings/page.tsx` を専用ページにして
モバイル時はアイコンのみ（テキストなし）を表示する。

デスクトップ版設定ページにも4タブ目を追加する（サイドバー形式なのでスペース問題なし）。

## Bottom Nav

```
ホーム | ブックマーク | フレンド | 通知 | プロフィール
                                          ↑
                               Link href="/sp/my"
                               Avatar or User icon
                               "プロフィール" label
                               active: pathname === "/sp/my"
```

## Routes

`SP_ROUTES` に `/my` を追加。
`/settings` は既に SP_ROUTES に含まれているか確認が必要。

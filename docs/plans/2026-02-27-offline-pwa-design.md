# オフライン PWA 強化設計

## 背景

現状の Service Worker は `@serwist/turbopack` を使用しているが、本番ビルドは webpack (`next build`) のため、プリキャッシュ manifest (`__SW_MANIFEST`) がビルド時に正しく注入されていない可能性がある。その結果、`_next/static/` の JS チャンクがキャッシュされず、オフライン時にアイコンや UI コンポーネントがロード中のまま固まる問題が発生している。

## 解決策

`@serwist/next` に移行する。これは Next.js (webpack) 向けの公式インテグレーションで、ビルド時にプリキャッシュ manifest を生成し、SW インストール時に全静的アセットをキャッシュする。

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `package.json` | `@serwist/turbopack` を `@serwist/next` に置き換え |
| `next.config.ts` | `withSerwist` の import 元変更、`swSrc`/`swDest` を設定 |
| `app/sw.ts` | `defaultCache` の import 元を `@serwist/next/worker` に変更、ナビゲーションタイムアウト追加 |
| `app/serwist/[path]/route.ts` | 削除（API Route 経由の配信が不要になる） |
| `components/sw-provider.tsx` | `@serwist/turbopack/react` を使わないシンプルな登録処理に変更 |
| `app/offline/page.tsx` | 新規作成（キャッシュが存在しない場合のフォールバックページ） |

## 仕組み（移行後）

### プリキャッシュ

`next build` 時に webpack プラグインが `_next/static/**` 全ファイルのリストを生成し、`public/sw.js` に `__SW_MANIFEST` として埋め込んでコンパイルする。SW のインストール時（ユーザーの初回アクセス時）にこれら全ファイルをキャッシュする。

### ランタイムキャッシュ

`@serwist/next/worker` の `defaultCache` は `_next/static/` に CacheFirst を適用する。フィンガープリント付き URL（コンテンツハッシュ）のため再検証は不要で、デプロイ時に URL が変わり古いキャッシュは自然に無効化される。

### ナビゲーションタイムアウト

`defaultCache` の navigation ハンドラに `networkTimeoutSeconds: 3` を追加する。オフライン時にネットワークリクエストが応答しない場合、3 秒でキャッシュにフォールバックし、無限ロードを解消する。

### オフラインフォールバック

キャッシュに存在しないページへのナビゲーションが失敗した場合、`/offline` ページを表示する。`app/offline/page.tsx` は静的ページとしてプリキャッシュ対象に含まれる。

## 開発モードの扱い

`next dev --turbopack` は webpack プラグインを実行しないため、dev では SW を生成しない。`SwProvider` は `process.env.NODE_ENV === "production"` の場合のみ登録するよう実装する。開発体験への影響はない。

## `public/sw.js`

すでに `.gitignore` 対象・git 未追跡であり、ビルド生成物として扱う。`@serwist/next` が `next build` 時に上書き生成する。

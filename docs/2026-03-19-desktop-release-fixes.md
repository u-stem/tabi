# デスクトップリリースパイプライン修正計画

> **Goal:** 自動アップデートが正しく動作し、全自動でリリースが完結するパイプラインにする

## 背景

v0.2.0 のリリースで以下の問題が判明:
- `latest.json` の URL が private リポジトリ (`u-stem/sugara`) を指しており、アップデーターがバイナリをダウンロードできない
- macOS の updater アセット (`.app.tar.gz`, `.app.tar.gz.sig`) が生成されていない
- v0.1.0 も同じ問題を抱えている

## Task 1: macOS updater アセットの生成を修正

**Files:**
- `apps/desktop/src-tauri/tauri.conf.json`

- [ ] `createUpdaterArtifacts: true` の状態で `targets: ["dmg", "nsis"]` が macOS の `.app.tar.gz` を生成するか Tauri v2 ドキュメントで確認
- [ ] 生成されない場合、`targets` に `"app"` を追加するか、`targets` を削除してデフォルトに戻す
- [ ] 変更をコミット

## Task 2: publish ジョブで latest.json の URL を書き換える

**Files:**
- `.github/workflows/desktop-build.yml`

`latest.json` 内の URL が `u-stem/sugara` (private) を指しているため、publish ジョブで `u-stem/sugara-releases` に書き換える。

- [ ] publish ジョブにステップを追加: `dist/latest.json` 内の URL を `sed` で置換
  - `https://github.com/u-stem/sugara/releases/download/` → `https://github.com/u-stem/sugara-releases/releases/download/`
- [ ] 変更をコミット

## Task 3: バージョンを 0.2.1 に上げてリリース・検証

- [ ] `tauri.conf.json` と `Cargo.toml` の version を `0.2.1` に更新
- [ ] コミット & push
- [ ] Desktop Tag → Desktop Build → publish の全フローが自動で通ることを確認
- [ ] `sugara-releases` の `latest.json` を確認:
  - URL が `u-stem/sugara-releases` を指していること
  - macOS (`darwin-aarch64`, `darwin-x86_64`) のプラットフォームが含まれていること
- [ ] macOS / Windows で実際にアップデート検知が動作するか確認

## Task 4: v0.1.0 のクリーンアップ

- [ ] `sugara-releases` の v0.1.0 リリースの `latest.json` も URL が壊れているが、v0.2.1 の `latest.json` が `/releases/latest/download/latest.json` で配信されるため、アップデーターは最新のみ参照する。対応不要
- [ ] v0.1.0 のリリースノートに「v0.2.x 以降にアップデートしてください」と追記

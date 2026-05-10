# QuickSkipSlience

動画・音声の無音部分を自動的にスキップする Chrome 拡張機能です。
YouTube など HTML5 の `video` / `audio` 要素を使うサイトで動作します。

このプロジェクトは [vantezzen/skip-silence](https://github.com/vantezzen/skip-silence) をフォークしたものです。オリジナルの素晴らしい拡張機能に、以下の変更を加えています。

- TEN VAD (WebAssembly) による音声検出を導入
- 無音スキップの設定をスライダー式に変更（再生速度・無音時間をより細かく調整可能）
- 日本語ローカライズ対応
- Manifest V3 対応
- 再生環境を Bun + Plasmo に移行
- チュートリアル・プロモーション・ライセンス認証・アナリティクスを削除（ミニマルなフォークとしての判断）

## インストール

```bash
git clone https://github.com/nanato12/QuickSkipSlience.git
cd QuickSkipSlience
bun install
bun run build
```

ビルド後、`build/chrome-mv3-prod` フォルダを Chrome 拡張機能から読み込んでください。

1. Chrome で `chrome://extensions` を開く
2. デベロッパーモードを有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `build/chrome-mv3-prod` を選択

## 開発

```bash
bun install
bun run dev    # Plasmo 開発サーバー起動
bun test       # Vitest テスト実行
bun run build  # Chrome MV3 ビルド
```

## 使用方法

1. YouTube など動画ページを開く
2. 拡張機能のアイコンをクリックしてポップアップを開く
3. トグルスイッチで有効化
4. 無音部分が自動的にスキップされます

### 設定項目

- **再生速度**: 通常時の再生速度（0.5x 〜 16x、0.25刻み）
- **無音時速度**: 無音検出時の再生速度（0.5x 〜 16x、0.25刻み）
- **音量しきい値**: 無音と判定する音量レベル
- **動的しきい値**: 音量に応じて自動でしきい値を調整（ベータ機能）
- **無音検出時間**: スキップを開始するまでの無音継続時間（0.25秒〜10秒、0.25秒刻み）

## ライセンス

[MIT License](LICENSE)

オリジナル作者: [vantezzen](https://github.com/vantezzen) — [skip-silence](https://github.com/vantezzen/skip-silence)

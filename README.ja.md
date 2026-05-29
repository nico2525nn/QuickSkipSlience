<p align="center">
  <a href="README.md">English</a> | <b>日本語</b>
</p>

# Quick Skip Silence

動画や音声の無音部分を自動的に早送りするブラウザ拡張機能。[vantezzen/skip-silence](https://github.com/vantezzen/skip-silence) からフォーク。

## これは何をするものか

動画や音声に無音の間があると、Quick Skip Silence がそれを検知して再生速度を早め（デフォルト: 3倍）、待ち時間を削減します。音声が再開すると通常速度に戻ります。

```
通常再生:    |████████████░░░░░░░░|████████████████|
              1倍再生            無音区間            1倍再生

拡張機能:    |████████████░░░░|████████████████|
              1倍再生           3倍（スキップ！）    1倍再生
```

## 機能

- **タブキャプチャ音声解析** — `chrome.tabCapture` API でタブの音声をキャプチャ（Chrome MV3 + オフスクリーンドキュメント）
- **しきい値の設定** — 無音と判定する音量レベルを調整可能（デフォルト: 30%）
- **動的しきい値** — 音声コンテンツに基づいてしきい値を自動調整
- **速度のカスタマイズ** — 通常パートと無音パートの再生速度を個別に設定可能
- **無音ミュート** — 早送り中の音声をミュート可能
- **オーディオ同期** — Chromiumのバグによる音声・映像のずれを定期的に修正
- **言語セレクター** — 英語と日本語のUI切替（ヘッダーのボタンで切替）
- **コマンドバー** — キーボードショートカットで操作できるオーバーレイ
- **VUメーター** — ポップアップ内の音量表示

## インストール

### Chrome（推奨）

1. このリポジトリをダウンロードまたはクローン
2. 拡張機能をビルド:
   ```bash
   pnpm install
   pnpm run build:mv3
   ```
3. `chrome://extensions` を開く
4. **デベロッパーモード** を有効にする
5. **パッケージ化されていない拡張機能を読み込む** をクリックし、`build/chrome-mv3-prod` フォルダを選択

### ビルド方法

```bash
# 依存関係のインストール
pnpm install

# Chrome MV3 用にビルド
pnpm run build:mv3

# 出力先: build/chrome-mv3-prod/
```

## 使い方

1. 動画や音声があるページを開く（例: YouTube）
2. ツールバーの拡張機能アイコンをクリック
3. **Quick Skip Silence を有効にする** をONにする
4. VUメーターで現在の音量を確認:
   - **青** = 通常再生
   - **オレンジ** = 早送り中（無音区間を検知）
5. 無音しきい値スライダーで検出感度を調整
6. 再生速度と無音時速度を設定

### キーボードショートカット

| ショートカット | アクション |
|---|---|
| `Ctrl+Shift+S` | ON/OFF切替 |
| `Alt+Shift+S` | コマンドバーの表示/非表示 |

## 仕組み

1. 有効にすると、バックグラウンドサービスワーカーが `chrome.tabCapture.getMediaStreamId()` でアクティブタブのストリームIDを取得
2. オフスクリーンドキュメントが作成され、ストリームIDを受け取る
3. オフスクリーンドキュメントが `getUserMedia()` でタブ音声ストリームを取得し、`AudioContext` + `AnalyserNode` を作成
4. 25msごとに音声波形からRMS音量を算出
5. 音量を `chrome.runtime.sendMessage()` でバックグラウンドに送信
6. `TabCaptureController` が音量をしきい値と比較
7. 音量がしきい値を下回り N サンプル続いたら早送り（`state.media_speed = 3`）
8. 音量がしきい値を超えたら通常速度に戻す（`state.media_speed = 1`）
9. コンテンツスクリプトが状態変更を検知し、`element.playbackRate` を適用

### アーキテクチャ

```
┌─────────────┐     streamId      ┌──────────────────┐
│  バックグラウンド│ ────────────────> │  オフスクリーン    │
│  (サービス    │ <──────────────── │  (AudioContext +  │
│   ワーカー)   │   tab-capture-    │   AnalyserNode)  │
│              │   volume          │                   │
│  TabCapture  │                   └──────────────────┘
│  Controller  │
│              │   media_speed 変更
│              │ ────────────────> ┌──────────────────┐
└─────────────┘                   │  コンテンツスクリプト│
                                  │  (SpeedController) │
                                  │  → playbackRate    │
                                  └──────────────────┘
```

## 設定一覧

| 設定 | デフォルト | 説明 |
|---|---|---|
| 再生速度 | 1倍 | 通常（有音）部分の再生速度 |
| 無音時速度 | 3倍 | 無音部分の再生速度 |
| 無音しきい値 | 30% | 無音と判定する音量レベル |
| 動的しきい値 | OFF | 音声に基づいてしきい値を自動調整 |
| サンプルしきい値 | 10 | 早送りするために必要な連続無音サンプル数 |
| 無音をミュート | OFF | 早送り中の音声をミュート |
| オーディオを同期 | OFF | Chromiumのバグによるずれを定期修正 |

## 既知の制限

- 非標準のオーディオ再生方法を使用するサイトでは動作しない（例: Spotify Web Player）
- Firefox ではタブキャプチャがサポートされていないため、要素ベースの解析のみ動作
- Chromium には速度を繰り返し変更すると音声・映像がずれるバグがある（回避策: 「オーディオを同期」設定）

## 開発

[Plasmo](https://docs.plasmo.com/) フレームワークで構築。

```bash
# インストール
pnpm install

# 開発サーバー（Chrome MV3）
pnpm run dev:mv3

# ビルド
pnpm run build:mv3
```

### プロジェクト構成

```
src/
├── background/
│   ├── BackgroundManager.ts    # タブ管理 + TabCaptureController
│   └── index.ts                # エントリーポイント
├── contents/
│   ├── index.tsx               # コンテンツスクリプト
│   └── lib/
│       ├── SpeedController.ts  # メディア要素に playbackRate を適用
│       ├── AudioSync.ts        # 音声・映像の同期修正
│       └── command-bar/        # コマンドバーオーバーレイ
├── shared/
│   ├── i18n.ts                 # 国際化（英語/日本語）
│   ├── state.ts                # 拡張機能の状態定義
│   ├── components/
│   │   ├── switch.tsx          # トグルスイッチ
│   │   └── speedSetting.tsx    # 速度セレクター
│   └── lib/
│       ├── SilenceSkipper.ts   # 要素ベースの無音検出
│       └── DynamicThresholdCalculator.ts
├── popup/
│   ├── index.tsx               # ポップアップ
│   └── components/
│       ├── header.tsx          # 言語切替付きヘッダー
│       ├── SettingsForm.tsx    # 設定UI
│       └── Footer.tsx          # フォーク元クレジット
├── assets/
│   ├── offscreen.html          # タブキャプチャ用オフスクリーン
│   └── offscreen.js            # オフスクリーン内音声解析
locales/
├── en/messages.json            # 英語メッセージ
└── ja/messages.json            # 日本語メッセージ
```

## クレジット

このプロジェクトは [vantezzen/skip-silence](https://github.com/vantezzen/skip-silence)（著者: [vantezzen](https://github.com/vantezzen)）からフォークしています。

元の作品は CaryKH の [自動オンザフライ動画編集ツール](https://www.youtube.com/watch?v=DQ8orIurGxw) に着想を得ています。

## ライセンス

[MIT ライセンス](LICENSE) — Copyright (c) 2019 Michael Xieyang Liu

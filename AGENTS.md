# Quick Skip Silence — AGENTS.md

## プロジェクト概要

「Quick Skip Silence」は、動画・音声の無音部分を自動的に早送りするブラウザ拡張機能。
[vantezzen/skip-silence](https://github.com/vantezzen/skip-silence) のフォーク。

## ブランチ一覧

| ブランチ | 説明 |
|---|---|
| master | **メインブランチ**。tabCaptureベースの完成版。リリース用 |
| feature/tab-capture | master と同じ内容（作業用ブランチ） |
| test/tab-capture-minimal | 最小限のtabCaptureテスト用（生のmanifest v3）。AGENTS.mdの実験記録あり |
| archive/master-pre-fork | フォーク元の vantezzen/skip-silence の master をアーカイブ |

## 環境

- OS: Windows (cmd.exe)
- パッケージマネージャー: **pnpm**（Bun は使わない）
- フレームワーク: Plasmo 0.90.5
- ビルドコマンド:
  ```bash
  pnpm install
  pnpm run build:mv3
  ```
- ビルド出力: `build/chrome-mv3-prod/`

## 最重要ルール: 処理の前に必ず検索する

**絶対に暗黙の前提や記憶だけでコードを書かないこと。**

1. 何かを実装・修正する前に、必ず検索する
   - Chrome API の仕様は公式ドキュメント（developer.chrome.com）を最優先
   - 既知のバグ・制約は issues.chromium.org / Stack Overflow / WICG の議論を確認
   - 不明なエラーはそのエラーメッセージで検索
2. 検索結果は必ず内容を確認する（タイトルだけで判断しない）
3. 同じ問題に対して3回以上失敗したら、検索ワードを変えて別の角度から調査する

## Chrome DevTools MCP の制約

### できないこと（最重要）
- **拡張機能は絶対に読み込めない**: MCPが起動するChromeは**すべての拡張機能が無効なクリーンプロファイル**で動作する
- **ファイル選択ダイアログの操作**: システムUIなので不可
- **Service Workerのコンソール確認**: chrome://inspect が必要

### 拡張機能をテストする正しい手順
1. 人間がリモートデバッグモードでChromeを起動する:
   ```cmd
   start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\学校\python\QuickSkipSlience\chrome-dev-profile"
   ```
2. `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」で `build/chrome-mv3-prod` を選択
3. MCPがこのChromeに接続する

## 拡張拡張機能のアーキテクチャ

```
Background (Service Worker)
  → TabCaptureController
    → offscreen.js (AudioContext + AnalyserNode)
      → RMS音量算出 → tab-capture-volume メッセージ
        → TabCaptureController.handleVolume()
          → state.media_speed = 3 or 1
            → コンテンツスクリプトが playbackRate を適用
```

### 主要ファイル
| ファイル | 役割 |
|---|---|
| `src/background/BackgroundManager.ts` | タブ管理、TabCaptureController |
| `src/assets/offscreen.js` | タブ音声のキャプチャと音量解析 |
| `src/contents/lib/SpeedController.ts` | メディア要素の再生速度制御 |
| `src/shared/state.ts` | 状態定義（enabled, media_speed, silence_threshold等） |
| `src/shared/i18n.ts` | 国際化（英語/日本語） |
| `src/popup/components/SettingsForm.tsx` | 設定UI |

## 致命的注意事項

### ユーザーは頻繁にコミットしない
- 未コミットの変更が消えると重大。作業前に必ず `git status && git branch`
- 間違えて別ブランチで作業した場合 → **絶対にコミットしない** → stash → 正しいブランチに移動 → stash pop

### カレントブランチを常に意識する
- 作業開始前に `git branch --show-current` で現在のブランチを確認
- 別ブランチに切り替えるときは `git checkout <branch>`（`--` なし）

## 実験済みの内容（test/tab-capture-minimal）

### 結論
- **MCP Chrome での拡張機能ロードは不可能**（クリーンプロファイル、OSダイアログ操作不可）
- ユーザーが `--remote-debugging-port=9222` でChromeを起動し、手動で拡張機能を読み込み、そのChromeにMCPが接続する流れが唯一の正解
- `--load-extension` + `--user-data-dir` は新規プロファイルでは効かない（初回起動時、確認画面が出るため）

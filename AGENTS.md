# Quick Skip Silence — AGENTS.md

---

## 最重要ルール（絶対に違反してはならない）

### ルール1: 検索なしで実装・修正禁止

**あらゆるコード変更、エラー修正、API利用の前に必ずWeb検索を実行すること。**

- あなたが「知っている」と思っていても、必ず検索して最新情報を確認する
- 検索は最低2回以上。異なるキーワードで複数角度から調査する
- 検索結果は必ず中身を確認する（タイトルだけで判断しない）
- 検索せずにコードを書くことは**禁止**
- 検索結果に基づき、以下の情報を提供すること:
  - 使用した検索キーワード
  - 参照した情報源（URL）
  - その情報がこのプロジェクトにどう適用されるか

**違反例（絶対にやってはならないこと）:**
- 「おそらくこうだろう」と推測でコードを書く
- 過去のセッションの記憶だけで実装する
- 公式ドキュメントを確認せずにChrome APIを使う
- エラーメッセージを検索せずに推測で修正する

### ルール2: エラー発生時は SESSION_HISTORY.md を確認する

**何かのエラーが出た場合、以下の順番で対処すること:**

1. **まず `SESSION_HISTORY.md` を読む** — 同じ問題が過去に解決済みかもしれない
2. そのエラーメッセージでWeb検索する
3. 公式ドキュメント（developer.chrome.com）を確認する
4. issues.chromium.org / Stack Overflow を確認する
5. それでも解決しない場合は、検索ワードを変えて別の角度から調査する

**`SESSION_HISTORY.md` に記録済みの問題:**
- MV3 での `tabCapture` は Service Worker から直接呼び出せない
- オフスクリーンドキュメントは `getUserMedia({ audio: { mandatory: { chromeMediaSource: "tab" } } })` の仕様が異なる
- `AudioContext` が `suspended` 状態になる問題
- オフスクリーンドキュメントの重複作成エラー
- MCP Chrome では拡張機能が読めない

### ルール3: このAGENTS.mdを常に意識する

**このファイルはセッションの最初から最後まで常に参照すべき最重要ドキュメントである。**

- タスクを始める前に必ずこのファイルを読み直す
- 実装中に迷ったら、このファイルを確認する
- このファイルのルールに従わない実装は**無効**
- 特に「致命的注意事項」と「最重要ルール」は常に頭に入れておくこと

---

## プロジェクト概要

「Quick Skip Silence」は、動画・音声の無音部分を自動的に早送りするブラウザ拡張機能。
[vantezzen/skip-silence](https://github.com/vantezzen/skip-silence) のフォーク。

**現在の状態**: tabCapture ベースの無音スキップが動作している。UI の日本語化・英語化切替、不要コンポーネント削除完了。

## ブランチ一覧

| ブランチ | 説明 |
|---|---|
| master | **メインブランチ**。tabCapture ベースの完成版。リリース用 |
| feature/tab-capture | master と同じ内容（作業用ブランチ） |
| test/tab-capture-minimal | 最小限の tabCapture テスト用（生の manifest v3）。実験記録あり |
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
- テスト: `bun test`（現在テストファイルなし）

## アーキテクチャ

```
Background (Service Worker)
  → TabCaptureController
    → offscreen.js (AudioContext + AnalyserNode)
      → RMS 音量算出 → tab-capture-volume メッセージ
        → TabCaptureController.handleVolume()
          → state.media_speed = 3 or 1
            → コンテンツスクリプトの SpeedController が playbackRate を適用
```

### 主要ファイル

| ファイル | 役割 |
|---|---|
| `src/background/BackgroundManager.ts` | タブ管理、TabCaptureController、オフスクリーン制御 |
| `src/assets/offscreen.html` | オフスクリーンドキュメントの HTML |
| `src/assets/offscreen.js` | タブ音声のキャプチャと音量解析（25ms ごとに RMS 算出） |
| `src/contents/index.tsx` | コンテンツスクリプト入口。tabCapture の場合は `request-activation` を送信 |
| `src/contents/lib/SpeedController.ts` | メディア要素に `playbackRate` を適用 |
| `src/contents/lib/browserSetup/shared.ts` | `state.media_speed` の変更を監視して SpeedController に反映 |
| `src/shared/state.ts` | 状態定義。`enabled`, `media_speed`, `silence_threshold`, `silence_speed` 等 |
| `src/shared/i18n.ts` | 国際化。`locales/en/messages.json` と `locales/ja/messages.json` から読む |
| `src/popup/index.tsx` | ポップアップ入口 |
| `src/popup/components/header.tsx` | ヘッダー。言語切替ボタン付き |
| `src/popup/components/SettingsForm.tsx` | 設定 UI。速度・しきい値・詳細設定 |
| `src/shared/components/switch.tsx` | トグルスイッチ。`enabled` 切替時に `start/stop-tab-capture` メッセージ送信 |
| `src/shared/components/speedSetting.tsx` | 速度セレクター |

### 状態の流れ

1. ユーザーがポップアップで `enabled` を ON → `switch.tsx` が `start-tab-capture` メッセージを送信
2. `BackgroundManager` → `TabCaptureController.start()` → オフスクリーン作成 → `tabCapture.getMediaStreamId()` → オフスクリーンに `start` コマンド送信
3. `offscreen.js` → `getUserMedia(tab)` → `AudioContext` + `AnalyserNode` → 25ms ごとに RMS 音量算出 → `tab-capture-volume` メッセージ送信
4. `TabCaptureController.handleVolume()` → 音量がしきい値を下回り N サンプル続いたら → `state.current.media_speed = 3`
5. `browserSetup/shared.ts` のリスナーが状態変更を検知 → `SpeedController.setPlaybackRate(3)` で再生速度変更
6. 音量がしきい値を超えたら → `state.current.media_speed = 1` で通常速度に戻す

### メッセージフロー

| メッセージ | 送信元 | 宛先 | 内容 |
|---|---|---|---|
| `start-tab-capture` | switch.tsx | BackgroundManager | タブキャプチャ開始 |
| `stop-tab-capture` | switch.tsx | BackgroundManager | タブキャプチャ停止 |
| `start` (offscreen) | TabCaptureController | offscreen.js | streamId 付きでキャプチャ開始 |
| `stop` (offscreen) | TabCaptureController | offscreen.js | キャプチャ停止 |
| `tab-capture-volume` | offscreen.js | TabCaptureController | 音量値（RMS × 5000） |
| `request-activation` | content/index.tsx | BackgroundManager | コンテンツスクリプト起動時の活性化要求 |

## Chrome DevTools MCP の制約

### できないこと（最重要）
- **拡張機能は絶対に読み込めない**: MCP が起動する Chrome は**すべての拡張機能が無効なクリーンプロファイル**で動作する
- **ファイル選択ダイアログの操作**: システム UI なので不可
- **Service Worker のコンソール確認**: chrome://inspect が必要

### 拡張機能をテストする正しい手順
1. 人間がリモートデバッグモードで Chrome を起動する:
   ```cmd
   start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\学校\python\QuickSkipSlience\chrome-dev-profile"
   ```
2. `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」で `build/chrome-mv3-prod` を選択
3. MCP がこの Chrome に接続する

## 完了済みの作業

### tabCapture ベースの実装
- `BackgroundManager.ts` に `TabCaptureController` クラスを追加
- `assets/offscreen.html` + `offscreen.js` でオフスクリーンドキュメントを実装
- `switch.tsx` で enabled トグル時に `start/stop-tab-capture` メッセージ送信
- `platform.ts` の `supportsTabCapture` を MV3 でも動作するように変更
- `package.json` に `offscreen` 権限と `web_accessible_resources` を追加

### UI 日本語化 & 英語化
- `locales/ja/messages.json` を新規作成（全キーを日本語翻訳）
- `src/shared/i18n.ts` を書き換え。Chrome 標準 i18n に依存せず、ローカル JSON から直接読む方式。`localStorage` に言語設定を保存
- ヘッダー右端に `EN` / `JA` 切替ボタンを追加

### 不要コンポーネント削除
- `NeonFin.tsx` + `.scss` — neonFin 広告バナー
- `v4info.tsx` + `.scss` — 「Welcome to v4!」バナー
- `plusInfo.tsx` + `.scss` — Skip Silence Plus アップセル
- `license.ts` — Gumroad API ライセンス検証
- `analytics.ts` — Simple Analytics / Plausible トラッキング
- `SettingsForm` 内のアナリティクス許可トグル、Plus 星マーク
- `speedSetting.tsx` からの `sa_event` / `plausible` 呼び出し除去
- `switch.tsx` からの `sa_event` / `plausible` 呼び出し除去
- `Command-Bar.md`, `FIREFOX-BUILD.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/` を削除

### ブランチ整理
- 旧 master を `archive/master-pre-fork` にアーカイブ
- master を feature/tab-capture の内容にリセット
- `.gitignore` を更新（`chrome-dev-profile/` を git 追跡から削除）

## 未完了のタスク

### 優先度: 高
- [ ] テストの作成（現在テストファイルなし）
- [ ] tabCapture 停止時のクリーンアップ改善（オフスクリーンの getUserMedia トラック停止）
- [ ] 複数タブ対応（現在はアクティブタブ1つのみ）

### 優先度: 中
- [ ] コマンドバーの日本語対応
- [ ] 拡張機能アイコンの更新（フォーク元のものを使用中）
- [ ] Chrome Web Store への公開準備（icon サイズ確認、説明文、スクリーンショット等）

### 優先度: 低
- [ ] Firefox 対応（tabCapture が非対応のため要素ベース解析のみ）
- [ ] TEN VAD 等の音声検出モデルの導入検討

## 致命的注意事項

### ユーザーは頻繁にコミットしない
- 未コミットの変更が消えると重大。作業前に必ず `git status && git branch`
- 間違えて別ブランチで作業した場合 → **絶対にコミットしない** → stash → 正しいブランチに移動 → stash pop

### カレントブランチを常に意識する
- 作業開始前に `git branch --show-current` で現在のブランチを確認
- 別ブランチに切り替えるときは `git checkout <branch>`（`--` なし）

### コードを書く前に
- **必ずこのAGENTS.mdの「最重要ルール」を読み直す**
- **必ず `SESSION_HISTORY.md` を確認する** — 過去の問題と修正歴を確認
- **必ずWeb検索を実行する** — 推測でコードを書かない
- Chrome API の仕様は公式ドキュメント（developer.chrome.com）を最優先で確認
- 既知のバグ・制約は issues.chromium.org / Stack Overflow / WICG の議論を確認
- 不明なエラーはそのエラーメッセージで検索
- 同じ問題に対して 3 回以上失敗したら、検索ワードを変えて別の角度から調査

## 実験済みの内容（test/tab-capture-minimal）

### 結論
- **MCP Chrome での拡張機能ロードは不可能**（クリーンプロファイル、OS ダイアログ操作不可）
- ユーザーが `--remote-debugging-port=9222` で Chrome を起動し、手動で拡張機能を読み込み、その Chrome に MCP が接続する流れが唯一の正解
- `--load-extension` + `--user-data-dir` は新規プロファイルでは効かない（初回起動時、確認画面が出るため）

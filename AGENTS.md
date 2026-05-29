# QuickSilence / tabCapture Test — AGENTS.md

## ブランチ一覧

現在使用しているブランチは以下の3つです:

| ブランチ | ベース | 説明 |
|---|---|---|
| main | vantezzen/skip-silence (latest) | TEN VAD + 要素モード |
| feature/tab-capture | upstream 80b4723 | tabCaptureベースの本実装ブランチ |
| test/tab-capture-minimal | upstream 80b4723 | 最小限のtabCaptureテスト用（生のmanifest v3） |

**注意**: 3つのブランチ間で内容が異なる場合は、**test/tab-capture-minimal の内容を優先**すること。

## 最重要ルール: 処理の前に必ず検索する

**絶対に暗黙の前提や記憶だけでコードを書かないこと。**

1. 何かを実装・修正する前に、**必ず open-websearch_search で検索する**
   - Chrome API の仕様は公式ドキュメント（developer.chrome.com）を最優先
   - 既知のバグ・制約は issues.chromium.org / Stack Overflow / WICG の議論を確認
   - 不明なエラーはそのエラーメッセージで検索
2. 検索結果は必ず open-websearch_fetchWebContent で中身を確認する（タイトルだけで判断しない）
3. 同じ問題に対して3回以上失敗したら、検索ワードを変えて別の角度から調査する
4. コードを書いた後も、使うAPIのドキュメントを再度確認して正しさを検証する

## 環境

- OS: Windows (cmd.exe)
- ランタイム: Bun 1.3.13+
- フレームワーク: Plasmo ^0.90.5（該当ブランチによる）
- ビルド: `cross-env PARCEL_WORKERS=0 plasmo build --target=chrome-mv3 --zip`
- テスト: `bun test`

## Chrome DevTools MCP の制約

### できること
| ツール | 用途 |
|---|---|
| navigate_page | URLを開く |
| list_console_messages | ページのコンソールログを取得 |
| evaluate_script | ページ上でJavaScriptを実行 |
| take_snapshot | ページのアクセシビリティツリーを取得 |
| take_screenshot | スクリーンショット（ただし画像は見れない） |
| click / fill | 要素のクリック・入力 |

### できないこと（最重要）
- **拡張機能は絶対に読み込めない**: MCPが起動するChromeは**すべての拡張機能が無効なクリーンプロファイル**で動作する。`--load-extension` も `chrome.developerPrivate.loadUnpacked()` も効かない。
- **ファイル選択ダイアログの操作**: システムUIなので不可
- **Service Workerのコンソール確認**: chrome://inspect が必要
- **Chromeの再起動**: chrome://restart は機能しない

### 拡張機能をテストする正しい手順
1. **人間がリモートデバッグモードでChromeを起動する**（まっさらな状態＋拡張機能を読み込むため）:
   ```cmd
   @echo off
   set CLEAN_PROFILE=%TEMP%\chrome-dev-profile
   start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%CLEAN_PROFILE%"
   ```
   その後 `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」で対象フォルダを選択する
2. **MCPがこのChromeに接続する**: 上記で起動したChromeに自動接続される
3. **reloadは自律的に可能**: `chrome.developerPrivate.reload()` で再読み込みできる

## Chrome プロファイル設定

### プロファイルパス
- プロファイルフォルダ: `D:\学校\python\QuickSkipSlience\chrome-dev-profile`
- このフォルダをプロジェクト直下に作成し、拡張機能を読み込んだ状態のChromeプロファイルとして使用する

### Chrome起動コマンド（AIが実行する）
デバッグモードのChromeが未起動の場合、以下のコマンドで起動する:
```cmd
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\学校\python\QuickSkipSlience\chrome-dev-profile"
```

**注意**: このChromeは通常のYouTube視聴用Chromeとは完全に別プロファイルなので、影響しない。

### MCPサーバー接続設定
- MCPサーバーは `--browserUrl http://127.0.0.1:9222` で接続する設定済みとする

### 拡張機能の再読み込み
- 拡張機能の再読み込みは `reload_extension` ツールを使う
- 事前に人間が一度だけ拡張機能を読み込んでおくことは許容する（完全自動化は無理と理解している）

### エラーハンドリング
- エラー時は適切にユーザーに伝えること

## 致命的注意事項

### ユーザーは頻繁にコミットしない
- 未コミットの変更が消えると重大。作業前に必ず `git status && git branch`
- 間違えて別ブランチで作業した場合 → **絶対にコミットしない** → stash → 正しいブランチに移動 → stash pop

### カレントブランチを常に意識する
- 作業開始前に `git branch --show-current` で現在のブランチを確認
- `git checkout master -- <file>` はブランチを切り替えずファイルだけを取得する
- 別ブランチに切り替えるときは `git checkout <branch>`（`--` なし）

## 実験済みの内容（test/tab-capture-minimal）

### 試した手順
1. `raw-test/` ディレクトリに最小限のmanifest v3拡張機能を作成（manifest.json + background.js + content.js）
2. `C:\Users\nico\Desktop\tabcapture-test\` にもコピー（パスに日本語なし）
3. Chromeを `--remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-dev-profile" --load-extension="..."` で起動
4. `chrome://extensions` で確認 → 拡張機能が一覧に表示されず、拡張機能数0
5. `chrome.developerPrivate.getExtensionsInfo()` → 空配列 `[]`
6. `chrome.developerPrivate.loadUnpacked()` → ファイルダイアログが開きタイムアウト
7. MCP Chrome（`chrome-devtools-mcp` が起動するクリーンプロファイルChrome）では **拡張機能は一切動作しない**

### 現在の結論
- **`--load-extension` + `--user-data-dir` は新規プロファイルでは効かない**（初回起動時、拡張機能の確認画面が出るため）
- **MCP Chrome での拡張機能ロードは不可能**（クリーンプロファイル、OSダイアログ操作不可）
- ユーザーが `--remote-debugging-port=9222` でChromeを起動し、手動で拡張機能を読み込み、そのChromeにMCPが接続する流れが唯一の正解

### 次のTODO
- [ ] ユーザーがリモートデバッグモードでChromeを起動して拡張機能を読み込む
- [ ] そのChromeにMCPが接続された状態でコンソールログを確認
- [ ] `[TabCaptureTest]` のログが出ていれば音声認識フローの調査に進む
- [ ] ログが出ていなければ背景スクリプト/コンテンツスクリプトの問題を切り分ける
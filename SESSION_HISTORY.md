# QuickSkipSlience — セッション履歴と問題修正記録

## 概要

このドキュメントは、Codex Desktop と OpenCode のセッションで発生した問題と、それに対する修正内容を時系列でまとめたものである。

---

## 1. Codex セッション一覧

| 日付 | セッション概要 | ブランチ |
|---|---|---|
| 2026-05-09 | QuickSilence Chrome拡張の完成（全フェーズ対応） | feature/tab-capture |
| 2026-05-29 | tabCapture ベースの音声認識デバッグ | test/tab-capture-minimal |

## 2. OpenCode セッション一覧

| セッションID | 内容 | 状態 |
|---|---|---|
| ses_18defe4f2ffe | フォーク後のクリーンアップと日本語化・MV3対応 | 完了 |
| ses_18e2c0c98ffe | .gitignore更新、AGENTS.md、raw-test/ 初期セットアップ | 実験 |
| ses_18e44abc5ffe | AGENTS.md のChromeデバッグ手順更新 | 完了 |
| ses_208cfd8c1ffe | build.bat再構築、bun.lock、BackgroundManager修正 | 実験 |
| ses_23afb23eaffe | esbuild移行、新アーキテクチャ構築（service-worker/offscreen/popup） | 実験 |

---

## 3. 問題と修正の詳細

### 3.1 MV2 → MV3 移行における tabCapture の問題

**問題**: Chrome MV3 では `chrome.tabCapture` API が Service Worker から直接呼び出せない。

**エラー**:
```
chrome.tabCapture.capture is not available in this context
```

**修正 (Codex 5/29, opencode ses_18e2c0c98ffe)**:
- Service Worker では `chrome.tabCapture.getMediaStreamId()` を使い、取得した `streamId` をオフスクリーンドキュメントに渡す構成に変更
- `raw-test/manifest.json` に `offscreen` 権限を追加
- `raw-test/background.js` に `ensureOffscreenDocument()` 関数を追加

```javascript
// Service Worker (background.js) での修正
const streamId = await chrome.tabCapture.getMediaStreamId({
  targetTabId: tab.id
});
// streamId を offscreen document に送信
chrome.runtime.sendMessage({
  target: "offscreen",
  command: "tabCapture-stream-id",
  streamId,
  tabId: tab.id
});
```

### 3.2 オフスクリーンドキュメントの getUserMedia が動かない

**問題**: オフスクリーンドキュメントで `getUserMedia({ audio: { mandatory: { chromeMediaSource: "tab" } } })` を呼び出すと失敗する。

**原因**: MV3 のオフスクリーンドキュメントでは `chromeMediaSource: "tab"` の `mandatory` フィールドの仕様が異なる可能性がある。また、`getUserMedia` のエラーハンドリングが不十分だった。

**修正 (Codex 5/29)**:
- エラーハンドリングを詳細化（`error.name` と `error.message` を分離出力）
- `offscreen.js` にリトライロジックを追加
- 音量値の RMS（二乗平均平方根）の計算式を `500 * peakInstantaneousPower` に変更して感度を調整

### 3.3 AudioContext の Suspended 状態

**問題**: `new AudioContext()` を作成した直後、`state` が `"suspended"` になり、音声解析ができない。

**修正 (opencode ses_208cfd8c1ffe)**:
`src/shared/lib/AudioContext.ts` にオフスクリーンドキュメント環境の判定を追加:

```typescript
export default function createAudioContextSecure(): Promise<AudioContext> {
  return new Promise((resolve, reject) => {
    const audioContext = new AudioContext();
    if (audioContext.state === 'suspended') {
      // Service Worker環境（documentが存在しない）
      if (typeof document === 'undefined') {
        if (typeof chrome !== 'undefined' && chrome.offscreen) {
          chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Resume AudioContext'
          }).catch(() => {})
        }
        return
      }
      // 通常のコンテキストではユーザー操作を要求
      const resumeElement = document.createElement('div');
      // ...
      resumeElement.addEventListener('click', async () => {
        await audioContext.resume();
        resumeElement.remove();
        resolve(audioContext);
      });
    } else {
      resolve(audioContext);
    }
  });
}
```

### 3.4 MV3 での `tabCapture.capture()` コールバック問題

**問題**: `src/shared/lib/Utils.ts` の `getTabAudioCapture()` が MV3 でも `chrome.tabCapture.capture()` を呼んでしまう。

**修正 (opencode ses_208cfd8c1ffe)**:
```typescript
const getTabAudioCapture = (): Promise<MediaStream | null> => {
  if (isMv3) {
    return Promise.resolve(null)  // MV3では直接capture不可
  }
  return new Promise((resolve) => {
    chrome.tabCapture.capture({ audio: true, video: false }, resolve)
  })
}
```

### 3.5 フォーク元からの不要コンポーネント残留

**問題**: vantezzen/skip-silence をフォークしたが、ネイティブアプリの広告バナー（NeonFin）、v4情報、Plus案内、ライセンス検証、アナリティクスコードが残っている。

**修正 (opencode ses_18defe4f2ffe)**:
削除したファイル:
| ファイル | 内容 |
|---|---|
| `src/popup/components/NeonFin.tsx` + `.scss` | neonFin 広告バナー |
| `src/popup/components/v4info.tsx` + `.scss` | 「Welcome to v4!」バナー |
| `src/popup/components/plusInfo.tsx` + `.scss` | Skip Silence Plus アップセル |
| `src/shared/license.ts` | Gumroad API ライセンス検証 |
| `src/shared/analytics.ts` | Simple Analytics トラッキング |
| `.github/` | リリースワークフロー、 ISSUE テンプレート |
| `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `Command-Bar.md`, `FIREFOX-BUILD.md` | フォーク元のドキュメント |

`SettingsForm.tsx` から `isPlus` / `showPlusPopup` プロパティと Plus 星マークを削除。

### 3.6 日本語化 (i18n) の問題

**問題**: Chrome 拡張の `chrome.i18n` API は `default_locale` が設定されている場合のみ動作する。また、`__()` ヘルパー関数が `webextension-polyfill` に依存している。

**修正 (opencode ses_18defe4f2ffe)**:
1. `locales/ja/messages.json` を新規作成（全キーを日本語翻訳）
2. `locales/en/messages.json` の拡張名を "Quick Skip Silence" に変更
3. `src/shared/i18n.ts` を書き換え、`localStorage` による言語設定と UI 切替を実装
4. ヘッダー右端に `EN` / `JA` 切替ボタンを追加

### 3.7 ビルドシステムの変遷

**問題**: 初期は `pnpm` + `plasmo` だったが、ビルド時間が長く、パッケージサイズが大きい。Bun への移行も試みたが Windows での互換性に課題。

**修正の経緯**:

| 段階 | ツール | 状態 |
|---|---|---|
| 1 | pnpm + plasmo | 動作するが遅い |
| 2 | bun + plasmo | bun.lockb 生成、Windows で若干の問題 |
| 3 | bun + esbuild | ses_23afb23eaffe で実験。高速だが未完成 |

最終的に `pnpm` + `plasmo` に戻し、esbuild は実験用に `raw-test/` で維持。

### 3.8 AGENTS.md の文字化け

**問題**: Codex Desktop が `AGENTS.md` を読むと、日本語部分が文字化けして表示される。

**原因**: Windows の `cmd.exe` と UTF-8 の相性問題。Codex が `Get-Content` を使う場合、エンコーディングが不一致になる。

**修正 (opencode ses_18e44abc5ffe)**:
- AGENTS.md に Chrome デバッグプロファイルのパスを明記
- `start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\学校\python\QuickSkipSlience\chrome-dev-profile"` の手順を追記
- MCP Chrome では拡張機能が読めない制約を明記

### 3.9 MCP Chrome での拡張機能テスト不可

**問題**: `chrome-devtools-mcp` が起動する Chrome は全拡張機能が無効なクリーンプロファイルで動作するため、開発中の拡張機能をテストできない。

**解決策 (AGENTS.md に記載)**:
1. ユーザーが `--remote-debugging-port=9222` で Chrome を起動
2. `chrome://extensions` → デベロッパーモード → パッケージ化されていない拡張機能を読み込む
3. MCP がその Chrome に接続する

### 3.10 service-worker.ts のオフスクリーンメッセージ配信

**問題 (Codex 5/29, opencode ses_23afb23eaffe)**:
Service Worker から offscreen document にメッセージを送る際、`chrome.runtime.sendMessage()` が失敗するケースがある（offscreen document がまだ作成されていない、または既に破棄されている）。

**修正**:
```javascript
async function sendToOffscreen(message) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (e) {
      console.warn(`sendToOffscreen attempt ${attempt} failed:`, e.message);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Offscreen document did not accept runtime message");
}
```

### 3.11 offscreen document の重複作成防止

**問題**: 複数タブで同時にオフスクリーンドキュメントを作成しようとするとエラーになる。

**修正 (Codex 5/29)**:
```javascript
let creatingOffscreenDocument;

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) return;

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["USER_MEDIA"],
      justification: "Capture tab audio for silence detection"
    });
  }
  await creatingOffscreenDocument;
  creatingOffscreenDocument = undefined;
}
```

### 3.12 esbuild ビルド時のオフスクリーン HTML 不足

**問題**: esbuild でバンドルしても `offscreen.html` が `dist/` に出力されない。

**修正 (opencode ses_23afb23eaffe)**:
`build.bat` に HTML ファイルのコピーコマンドを追加:
```batch
:: Copy offscreen HTML
copy /Y "src\offscreen\offscreen.html" "dist\src\offscreen\offscreen.html" >nul
```

### 3.13 音量閾値の感度調整

**問題**: デフォルトのしきい値では、YouTube の動画で音声があるのに無音と判定される、逆に無音なのに音声があると判定される。

**修正の経緯**:
| ソース | しきい値 | 備考 |
|---|---|---|
| フォーク元 (state.ts) | `silence_threshold: 30` | peak instantaneous power × 500 |
| raw-test offscreen.js | `threshold: 5` | `500 * peakInstantaneousPower` |
| ses_23afb23eaffe | `DEFAULT_THRESHOLD: 0.01` | RMS ベースに変更、ヒステリシス追加 |

最終的な無音判定ロジック:
- RMS（二乗平均平方根）を `AnalyserNode.getFloatTimeDomainData()` で取得
- threshold と比較して無音/有音を判定
- ヒステリシス（`HYSTERESIS_RATIO: 1.5`）でノイズによるちらつきを防止
- 連続フレーム確認（`SILENCE_START_FRAMES: 3`, `SILENCE_END_FRAMES: 2`）

---

## 4. アーキテクチャの変遷

### Phase 1: フォーク直後
```
Plasmo (MV2/MV3) + plasmo-state
  → BackgroundManager.ts (tabCapture直接呼び出し)
    → SilenceSkipper.ts (element/tabCapture/displayMedia)
      → SampleInspector.ts → SpeedController.ts
```

### Phase 2: MV3 移行（Codex 5/29）
```
Service Worker → tabCapture.getMediaStreamId()
  → offscreen document → getUserMedia(streamId)
    → AudioContext + AnalyserNode → RMS音量算出
      → chrome.runtime.sendMessage → content script
        → SpeedController.setPlaybackRate()
```

### Phase 3: 新アーキテクチャ（opencode ses_23afb23eaffe）
```
service-worker.ts (設定管理、streamId発行、メッセージ中継)
  → offscreen.ts + audio-analyzer.ts (音声解析)
    → youtube-controller.ts (速度制御、DOM操作)
      → popup.ts (UI制御)
```

---

## 5. ブランチ整理

| ブランチ | ベース | 用途 |
|---|---|---|
| master | フォーク後 | メインブランチ（tabCapture完成版） |
| feature/tab-capture | master と同じ | 作業用 |
| test/tab-capture-minimal | upstream 80b4723 | 最小限の tabCapture テスト |
| archive/master-pre-fork | vantezzen original | フォーク元のアーカイブ |

---

## 6. 残存課題

1. **テストの不在**: `bun test` を実行できるテストファイルが存在しない
2. **複数タブ対応**: 現在はアクティブタブ1つのみ。複数タブ同時対応は未実装
3. **tabCapture 停止時のクリーンアップ**: オフスクリーンの `getUserMedia` トラック停止が不完全
4. **esbuild 移行の未完了**: build.bat は作成したが、Plasmo との併用が不安定
5. **TEN VAD の導入検討**: 音声検出精度向上のためのモデル検討（未着手）

---

## 7. 学んだ教訓

1. **Chrome API は公式ドキュメントを最優先**: 暗黙の前提で実装すると間違える
2. **MV3 は Service Worker + offscreen の分離が必須**: AudioContext は offscreen で動かす
3. **オフスクリーンドキュメントは1つだけ**: 重複作成はエラーになる
4. **MCP Chrome では拡張機能テスト不可**: 必ずユーザー側でデバッグ用 Chrome を起動する
5. **文字化け対策**: Windows + UTF-8 はエンコーディングに注意する

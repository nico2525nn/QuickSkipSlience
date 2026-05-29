<p align="center">
  <b>English</b> | <a href="README.ja.md">日本語</a>
</p>

# Quick Skip Silence

A browser extension that automatically speeds up silent parts of videos and audio. Forked from [vantezzen/skip-silence](https://github.com/vantezzen/skip-silence).

## What it does

When a video or audio has silent pauses, Quick Skip Silence detects them and speeds up playback (default: 3x) so you don't have to wait. When speech or sound resumes, it returns to normal speed.

```
Normal audio:    |████████████░░░░░░░░|████████████████|
                  1x playing          silent pause      1x playing

With extension:  |████████████░░░░|████████████████|
                  1x playing       3x (skipped!)      1x playing
```

## Features

- **Tab Capture audio analysis** — captures tab audio via `chrome.tabCapture` API (Chrome MV3 + offscreen document)
- **Configurable silence threshold** — set the volume level below which audio is considered silent (default: 30%)
- **Dynamic threshold** — automatically adjusts the silence threshold based on the audio content
- **Adjustable speeds** — set custom playback speed for normal parts (default: 1x) and silent parts (default: 3x)
- **Mute silence** — optionally mute audio during sped-up sections
- **Audio sync fix** — periodically resyncs audio/video to work around a Chromium bug
- **Language selector** — English and Japanese UI (toggle in the header)
- **Command bar** — quick-access overlay with keyboard shortcuts
- **VU meter** — visual volume indicator in the popup

## Installation

### Chrome (recommended)

1. Download or clone this repository
2. Build the extension:
   ```bash
   pnpm install
   pnpm run build:mv3
   ```
3. Open `chrome://extensions`
4. Enable **Developer mode**
5. Click **Load unpacked** and select the `build/chrome-mv3-prod` folder

### Manual build

```bash
# Install dependencies
pnpm install

# Build for Chrome MV3
pnpm run build:mv3

# The output will be at build/chrome-mv3-prod/
```

## Usage

1. Open any page with video/audio (e.g. YouTube)
2. Click the extension icon in the toolbar
3. Toggle **Enable Quick Skip Silence** on
4. The VU meter shows the current volume:
   - **Blue** = normal playback
   - **Orange** = sped up (silent section detected)
5. Adjust the silence threshold slider to fine-tune detection sensitivity
6. Set your preferred playback and silence speeds

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+S` | Toggle enable/disable |
| `Alt+Shift+S` | Show/hide command bar |

## How it works

1. When enabled, the background service worker calls `chrome.tabCapture.getMediaStreamId()` to get a stream ID for the active tab
2. An offscreen document is created and receives the stream ID
3. The offscreen document calls `getUserMedia()` with the tab audio stream, creates an `AudioContext` + `AnalyserNode`
4. Every 25ms, the RMS volume is calculated from the audio waveform
5. The volume is sent back to the background via `chrome.runtime.sendMessage()`
6. `TabCaptureController` compares the volume against the threshold
7. When volume stays below threshold for N samples → speeds up (`state.media_speed = 3`)
8. When volume rises above threshold → slows down (`state.media_speed = 1`)
9. The content script detects the state change and applies `element.playbackRate`

### Architecture

```
┌─────────────┐     streamId      ┌──────────────────┐
│  Background  │ ────────────────> │  Offscreen Doc   │
│  (Service    │ <──────────────── │  (AudioContext +  │
│   Worker)    │   tab-capture-    │   AnalyserNode)  │
│              │   volume          │                   │
│  TabCapture  │                   └──────────────────┘
│  Controller  │
│              │   media_speed change
│              │ ────────────────> ┌──────────────────┐
└─────────────┘                   │  Content Script   │
                                  │  (SpeedController) │
                                  │  → playbackRate    │
                                  └──────────────────┘
```

## Settings

| Setting | Default | Description |
|---|---|---|
| Playback Speed | 1x | Speed during normal (non-silent) audio |
| Silence Speed | 3x | Speed during silent sections |
| Silence Threshold | 30% | Volume level below which audio is considered silent |
| Dynamic Threshold | off | Auto-adjusts threshold based on audio content |
| Sample Threshold | 10 | Number of consecutive silent samples before speeding up |
| Mute Silence | off | Mute audio during sped-up sections |
| Keep Audio in Sync | off | Periodically resync to fix Chromium desync bug |

## Known limitations

- Does not work on sites that use non-standard audio playback (e.g. Spotify Web Player)
- On Firefox, tab capture is not supported — only element-based analysis works
- Chromium has a bug where audio/video desync when repeatedly changing speed (workaround: "Keep Audio in Sync" setting)

## Development

Built with [Plasmo](https://docs.plasmo.com/) framework.

```bash
# Install
pnpm install

# Dev server (Chrome MV3)
pnpm run dev:mv3

# Build
pnpm run build:mv3
```

### Project structure

```
src/
├── background/
│   ├── BackgroundManager.ts    # Tab management + TabCaptureController
│   └── index.ts                # Entry point
├── contents/
│   ├── index.tsx               # Content script entry
│   └── lib/
│       ├── SpeedController.ts  # Applies playbackRate to media elements
│       ├── AudioSync.ts        # Audio/video resync workaround
│       └── command-bar/        # Command bar overlay
├── shared/
│   ├── i18n.ts                 # Internationalization (EN/JA)
│   ├── state.ts                # Extension state definition
│   ├── analytics.ts            # Analytics (disabled)
│   ├── components/
│   │   ├── switch.tsx          # Toggle switch component
│   │   └── speedSetting.tsx    # Speed selector component
│   └── lib/
│       ├── SilenceSkipper.ts   # Element-based silence detection
│       └── DynamicThresholdCalculator.ts
├── popup/
│   ├── index.tsx               # Popup entry
│   └── components/
│       ├── header.tsx          # Header with language toggle
│       ├── SettingsForm.tsx    # Settings UI
│       └── Footer.tsx          # Fork credit
├── assets/
│   ├── offscreen.html          # Offscreen document for tab capture
│   └── offscreen.js            # Audio analysis in offscreen context
locales/
├── en/messages.json            # English strings
└── ja/messages.json            # Japanese strings
```

## Credits

This project is forked from [vantezzen/skip-silence](https://github.com/vantezzen/skip-silence) by [vantezzen](https://github.com/vantezzen).

Original work inspired by CaryKH's [automatic on-the-fly video editing tool](https://www.youtube.com/watch?v=DQ8orIurGxw).

## License

[MIT License](LICENSE) — Copyright (c) 2019 Michael Xieyang Liu

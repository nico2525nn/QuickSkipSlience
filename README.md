# QuickSkipSlience

A Chrome extension that automatically skips silent parts in videos and audio files.
Works on websites using HTML5 `video` / `audio` elements, such as YouTube.

> 📖 [日本語版はこちら](README.ja.md)

## About

This project is a **fork** of [vantezzen/skip-silence](https://github.com/vantezzen/skip-silence), a great browser extension for skipping silence in videos. We forked it to experiment with some changes that may not fit the original project's direction:

- Integrated [TEN VAD](https://github.com/mk-min-hun/ten-vad) (WebAssembly) for voice activity detection
- Replaced speed presets with range sliders (finer control over playback speed and silence duration)
- Japanese localization (`default_locale: ja`)
- Migrated to Manifest V3
- Migrated build environment to Bun + Plasmo
- Stripped out tutorial, promotions, license system, and analytics (personal preference for a minimal fork)

## Installation

```bash
git clone https://github.com/nanato12/QuickSkipSlience.git
cd QuickSkipSlience
bun install
bun run build
```

After building, load the extension into Chrome:

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `build/chrome-mv3-prod`

## Development

```bash
bun install
bun run dev    # Start Plasmo dev server (hot reload)
bun test       # Run Vitest tests
bun run build  # Build for Chrome MV3
```

## Usage

1. Open a video page (e.g., YouTube)
2. Click the extension icon to open the popup
3. Toggle the switch to enable
4. Silent parts will be automatically skipped

### Settings

| Setting | Description | Range |
|---|---|---|
| Playback Speed | Speed for normal (non-silent) parts | 0.5x – 16x, step 0.25 |
| Silence Speed | Speed for silent parts | 0.5x – 16x, step 0.25 |
| Volume Threshold | Volume level below which is considered silence | 0% – 100% |
| Dynamic Threshold | Automatically adjust threshold based on audio level | On/Off (beta) |
| Silence Duration | How long silence must last before skipping | 0.25s – 10s, step 0.25s |

## How it works

The extension uses the Web Audio API to analyze the audio stream of a video/audio element in real time. It combines traditional volume thresholding with TEN VAD (Voice Activity Detection) to accurately detect silence:

```
isSilent = volume < threshold AND vad does NOT detect speech
```

When silence is detected for a configurable duration, the playback speed is increased. Once speech or sufficient volume returns, speed returns to normal.

## License

[MIT License](LICENSE)

Original author: [vantezzen](https://github.com/vantezzen) — [skip-silence](https://github.com/vantezzen/skip-silence)

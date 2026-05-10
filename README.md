# Batch Studio PC
<img width="1442" height="932" alt="image" src="https://github.com/user-attachments/assets/7c810195-4743-4055-8693-66c3bcacd160" />

A FREE powerful desktop video editor for repurposing source **videos or static images** into multiple platform-sized outputs (Instagram, TikTok, YouTube, etc.) with text, icon overlays, and compliance badges.

Everything runs locally on your PC — no media is ever uploaded to a server, and exports are powered by a high-performance FFmpeg-native pipeline.

## Features

- **Desktop Native:** Fast performance, native file dialogs, and robust drag-and-drop support.
- **FFmpeg Integration:** High-quality video encoding using a bundled FFmpeg binary (single-pass resize + overlay + concat).
- **Mix Media:** Upload videos (MP4/WebM/MOV…) or static images (JPG/PNG/WebP/SVG…); mix them freely in the render queue.
- **Platform Presets:** 20+ built-in presets (Instagram, YouTube, TikTok, etc.) — fully editable, with drag-to-reorder groups and templates.
- **Fit Modes:** Crop, Blur, Letterbox, and Manual positioning.
- **Smart Overlays:** Responsive text and icon overlays with per-icon minimum-size constraints.
- **Undo / Redo:** Full history of overlay, transform, and queue changes (configurable depth).
- **In-App Asset Management:** Add or remove compliance icons and safe-zone images at runtime, stored in a writable per-user directory.
- **Outro Support:** Automatically append an outro video to every rendered output via FFmpeg `concat`.
- **Cancel-able Renders:** Stop a render mid-flight from the UI.
- **Hardened IPC:** All Rust commands validate inputs (magic bytes, numeric ranges, schema-checked config).
- **Privacy First:** All processing happens offline on your machine — no network calls at runtime.

## Download builds

The latest portable and installer builds available at:
https://github.com/asafco83/BatchStudio_PC/releases/latest

## Tech Stack

- **Frontend:** React 18 · Vite 6 · Tailwind 3 · lucide-react
- **Desktop Core:** Tauri v2 (Rust)
- **Render Engine:** FFmpeg-native (via Tauri IPC)
- **Styling:** CSS Container Queries (`cqw` units) for responsive overlays

## Documentation

- [User Guide](docs/USER_GUIDE.md) — How to use the app.
- [Developer Docs](docs/DEVELOPERS.md) — Architecture, Tauri bridge, and build instructions.
- [Dependencies](docs/dependencies.md) — Inventory of libraries and third-party resources.

## Development

### Prerequisites
- Node.js (v18+)
- Rust & Cargo (for Tauri)
- WebView2 (Windows)

### Setup & Run
```bash
npm install
npm run tauri:dev
```

### Tests
Frontend utility unit & property tests run via Vitest:
```bash
npm test
```

## Building for Production

To create a standalone Windows executable (`.exe`, `.msi`, and NSIS `setup.exe`):

```bash
npm run tauri:build
```

Outputs land in:
- `src-tauri/target/release/batch-studio.exe` — the raw binary
- `src-tauri/target/release/bundle/nsis/Batch Studio_<ver>_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/Batch Studio_<ver>_x64_en-US.msi`

The Rust dependencies are vendored under `src-tauri/vendor/`, so the build runs offline once `node_modules/` is installed.


## Project Layout

```
.
├── src/                       # React frontend
│   ├── App.jsx                # Main application logic & UI
│   ├── tauri-bridge.js        # Abstraction layer for desktop/web logic
│   ├── main.jsx               # React root
│   ├── index.css              # Tailwind + base styles
│   └── utils/
│       ├── icon-calculations.js  # Pure helpers (sizing, clamping, centering)
│       └── __tests__/            # Vitest unit + property tests
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs             # All Tauri commands & validation
│   │   └── main.rs            # Thin entry that calls lib::run()
│   ├── tauri.conf.json        # App config, bundle targets, resources
│   ├── capabilities/          # Per-window permission capabilities
│   ├── binaries/              # FFmpeg sidecar (per platform)
│   ├── resources/             # Bundled defaults (config, fonts, icons, safezones)
│   └── vendor/                # Vendored Rust crates (offline build)
├── public/                    # Dev-mode static assets
├── docs/                      # User & developer documentation
└── Batch-Studio-portable.zip  # Released portable build
```


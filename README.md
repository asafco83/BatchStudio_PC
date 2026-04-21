# Batch Studio PC

A powerful desktop video editor for repurposing a single source video **or static image** into multiple platform-sized outputs (Instagram, TikTok, YouTube, etc.) with text, icon overlays, and compliance badges.

Everything runs locally on your PC — no media is ever uploaded to a server, and exports are powered by a high-performance FFmpeg-native pipeline.

## Features

- **Desktop Native:** Fast performance, native file dialogs, and robust drag-and-drop support.
- **FFmpeg Integration:** High-quality video encoding using a bundled FFmpeg binary.
- **Mix Media:** Upload videos (MP4/WebM/MOV…) or static images (JPG/PNG/WebP…); mix them freely in the render queue.
- **Platform Presets:** 20+ built-in presets (Instagram, YouTube, TikTok, etc.) — fully editable.
- **Fit Modes:** Crop, Blur, Letterbox, and Manual positioning.
- **Smart Overlays:** Responsive text and icon overlays with per-icon constraints.
- **Outro Support:** Automatically append an outro video to every rendered output.
- **Privacy First:** All processing happens offline on your machine.

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

## Building for Production

To create a standalone Windows executable (`.exe` or `.msi`):

```bash
npm run tauri:build
```

The installer will be generated in `src-tauri/target/release/bundle/`.

## Project Layout

```
.
├── src/                 # React frontend
│   ├── tauri-bridge.js  # Abstraction layer for desktop/web logic
│   └── App.jsx          # Main application logic
├── src-tauri/           # Tauri (Rust) configuration and commands
├── public/              # Static assets (icons, safezones)
├── docs/                # Documentation
└── resources/           # Bundled app resources (config, ffmpeg)
```


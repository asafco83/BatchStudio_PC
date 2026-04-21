# Batch Studio PC — Developer Documentation

Technical reference for working on the Batch Studio PC codebase.

---

## 1. Stack and Architecture at a Glance

Batch Studio has evolved from a web application into a **Tauri-based desktop application**.

- **Frontend:** React 18 + Vite 6 + Tailwind 3
- **Desktop core:** Tauri v2 (Rust)
- **Video encode:** High-performance FFmpeg-native pipeline (via Tauri IPC)
- **Image encode:** Browser-native Canvas 2D + `canvas.toBlob()`
- **Persistence:** Local `config.json` managed via Tauri's filesystem plugin
- **Native features:** System file dialogs, native window drag-and-drop, and bundled FFmpeg binaries

---

## 2. Project Structure

```
.
├── src/
│   ├── App.jsx              # Main application logic
│   ├── tauri-bridge.js      # Abstraction layer between UI and Tauri/Web
│   ├── main.jsx             # React root
│   └── index.css            # Tailwind entry + base styles
├── src-tauri/
│   ├── src/main.rs          # Tauri entry point and command definitions
│   ├── tauri.conf.json      # Tauri configuration (permissions, bundles, etc.)
│   └── binaries/            # Bundled FFmpeg binaries
├── public/
│   └── ...                  # Static assets for the webview
├── resources/
│   ├── config.json          # Persisted app configuration
│   ├── compliance/          # Compliance icon images
│   └── safezones/           # Safe-zone preview images
├── docs/
│   ├── USER_GUIDE.md
│   ├── DEVELOPERS.md        # You are here
│   └── dependencies.md
└── package.json
```

---

## 3. Getting Started

```bash
npm install
npm run tauri:dev        # Runs the Vite dev server and launches the Tauri window
npm run tauri:build      # Builds the production installer (EXE/MSI on Windows)
```

For development, ensure you have the Tauri prerequisites installed (Rust, WebView2, and C++ build tools).

---

## 4. The Tauri Bridge (`tauri-bridge.js`)

The application uses an abstraction layer (`src/tauri-bridge.js`) to decouple the React UI from the underlying platform. This allows the same UI code to potentially run in both desktop and web environments.

| Function | Desktop (Tauri) Behavior | Web Fallback |
|----------|--------------------------|--------------|
| `loadConfig` | Invokes `read_config` Rust command | Fetches `/config.json` |
| `persistConfig` | Invokes `save_config` Rust command | POSTs to `/api/save-config` |
| `pickMediaFiles` | Opens native `dialog` plugin | Not supported |
| `getPreviewUrl` | Uses `convertFileSrc` to bypass CSP | Returns the original path |
| `encodeVideoDirect`| Invokes `encode_video_direct` FFmpeg command | Not supported |

---

## 5. Render / Export Pipeline

Batch Studio PC departs from the `MediaRecorder` API in favor of a robust FFmpeg pipeline.

### Video Flow (`encodeVideoFFmpeg`)

1. **Overlay Flattening:** The frontend renders all text and icon overlays onto a single transparent PNG using a hidden canvas.
2. **IPC Trigger:** The path to the source video and the generated overlay PNG are sent to the Rust backend via `encode_video_direct`.
3. **FFmpeg Command:** The Rust command spawns the bundled FFmpeg binary with a filter complex to:
   - Handle the chosen **Fit Mode** (Crop, Blur, Fit).
   - Apply the **Manual Transform** (Scale/Offset).
   - Overlay the transparent PNG on top of the media.
   - Sync the audio track.
4. **Output:** FFmpeg writes the output directly to the user's filesystem.

### Image Flow (`encodeStaticImage`)

Image export still uses the browser's Canvas API for speed and simplicity:
1. Composites the source image and overlays onto a `canvas`.
2. Uses `canvas.toBlob()` to generate the PNG/JPG data.
3. Uses `tauri-bridge` to write the resulting buffer to the native filesystem.

---

## 6. Patterns & Gotchas

- **Lazy Loading:** Tauri plugins are dynamically imported in `tauri-bridge.js` to prevent the web-only dev server from crashing when Tauri globals are missing.
- **Path Handling:** Always use absolute paths when dealing with native commands. Use `convertFileSrc` when the browser needs to display a local file.
- **FFmpeg Binaries:** The `binaries/` folder in `src-tauri` must contain the platform-specific FFmpeg executables (e.g., `ffmpeg-x86_64-pc-windows-msvc.exe`).
- **Config Resources:** While `public/config.json` is used in dev, the production app relies on the `resources/` folder configured in `tauri.conf.json`.

---

## 7. Where Things Live — Quick Index

| Feature | Location |
|---------|----------|
| Fit-mode logic | `App.jsx` -> `drawMediaFit` (UI) / Rust `commands` (Export) |
| Overlay Composite | `App.jsx` -> `drawOverlays` |
| Native Bridge | `src/tauri-bridge.js` |
| Rust Commands | `src-tauri/src/main.rs` (or modular command files) |
| App Configuration| `src-tauri/tauri.conf.json` |
| Dependencies | `docs/dependencies.md` |

# Batch Studio PC — Developer Documentation

Technical reference for working on the Batch Studio PC codebase.

---

## 1. Stack and Architecture at a Glance

Batch Studio is a **Tauri v2 desktop application** with a React frontend and a Rust backend that orchestrates a bundled FFmpeg sidecar.

- **Frontend:** React 18 + Vite 6 + Tailwind 3 + lucide-react
- **Desktop core:** Tauri v2 (Rust, edition 2021)
- **Video encode:** FFmpeg-native pipeline (`encode_video_direct` Rust command, single-pass filtergraph)
- **Image encode:** Browser-native Canvas 2D + `canvas.toBlob()`, written via `tauri-plugin-fs`
- **Persistence:** `config.json` in the per-user app data directory, schema-validated on save
- **Native features:** System file dialogs, native window drag-and-drop, sidecar binary execution, file picker, save dialog
- **Tests:** Vitest (unit + property-based) for pure utility functions

---

## 2. Project Structure

```
.
├── src/
│   ├── App.jsx                # Main application logic & UI (single component file)
│   ├── tauri-bridge.js        # Abstraction layer between UI and Tauri/Web
│   ├── main.jsx               # React root
│   ├── index.css              # Tailwind entry + extracted base styles (no inline <style> blocks)
│   └── utils/
│       ├── icon-calculations.js    # Pure helpers — sizing, clamping, centering, safe-area color
│       └── __tests__/              # Vitest unit + fast-check property tests
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs             # All Tauri commands, validation helpers, FFmpeg orchestration
│   │   └── main.rs            # Thin entry — calls batch_studio::run()
│   ├── tauri.conf.json        # Bundle targets, identifier, resources, security policy
│   ├── capabilities/
│   │   └── default.json       # Per-window permission allowlist (incl. ffmpeg sidecar scope)
│   ├── binaries/
│   │   └── ffmpeg-x86_64-pc-windows-msvc.exe   # Sidecar binary (per-platform suffix)
│   ├── resources/             # Bundled defaults: config.json, fonts/, compliance/, safezones/, icons/
│   ├── vendor/                # Vendored Rust crates — supports offline build
│   ├── Cargo.toml             # Lib + bin crate; release profile uses LTO, opt-level "s", strip
│   └── build.rs
├── public/                    # Dev-mode assets (Vite)
├── docs/
│   ├── USER_GUIDE.md
│   ├── DEVELOPERS.md          # You are here
│   ├── dependencies.md
│   └── SECURITY_REVIEW_RESPONSE.md
├── setup-tauri.ps1            # First-time setup: downloads fonts, mirrors public/ → src-tauri/resources/
└── package.json
```

The Rust crate is structured as `lib + bin` so both `cargo test` and the Tauri CLI work uniformly. `main.rs` is a 5-line shim around `lib::run()`.

---

## 3. Getting Started

```bash
npm install
npm run tauri:dev          # Vite dev server + Tauri window with hot-reload
npm test                   # Vitest unit/property tests
npm run tauri:build        # Production: builds Vite, compiles Rust release, bundles NSIS + MSI
```

Prerequisites: Rust + Cargo, Node.js 18+, WebView2 runtime (Windows), MSVC C++ build tools.

First-time-only helper: `setup-tauri.ps1` downloads the Inter / JetBrainsMono `.woff2` files into `public/fonts/` and mirrors `public/{compliance,safezones,config.json}` into `src-tauri/resources/` for bundling.

---

## 4. The Tauri Bridge (`src/tauri-bridge.js`)

Single abstraction layer between the React UI and the Rust backend. Every export checks `isTauri` at runtime and either invokes a Rust command or falls back to the web behavior (used for `npm run dev` standalone).

| Export | Tauri Behavior | Web Fallback |
|--------|----------------|--------------|
| `loadConfig` / `persistConfig` | `read_config` / `save_config` (schema-validated) | `fetch('/config.json')` / `POST /api/save-config` |
| `getComplianceFiles` / `getSafezoneFiles` | `list_compliance_files` / `list_safezone_files` | `fetch('/api/...')` |
| `getAssetDir` (cached per kind) | `get_asset_dir` | `null` |
| `getAssetUrl(kind, file)` | `convertFileSrc` against the writable asset dir | `/<kind>/<file>` |
| `addAssetFile` / `deleteAssetFile` | `add_asset_file` / `delete_asset_file` | unsupported |
| `pickMediaFiles` / `pickVideoFile` / `pickImageFiles` | `@tauri-apps/plugin-dialog` `open` with extension filters | `null` |
| `pickSaveLocation` / `pickOutputFolder` | dialog `save` / `open({ directory: true })` | `null` |
| `getPreviewUrl` | `convertFileSrc` (with `asset.localhost` fallback) | passes path through |
| `setupDragDrop(onDrop)` | `getCurrentWindow().onDragDropEvent` listener | no-op |
| `createRenderSession` / `cleanupSession` | `create_render_session` / `cleanup_session` | — |
| `encodeVideoDirect` | `encode_video_direct` (FFmpeg-native, primary path) | — |
| `encodeVideoCmd` | `encode_video` (legacy frame-by-frame fallback) | — |
| `concatVideos` | `concat_videos` (outro append) | — |
| `cancelRender` | `cancel_render` (cooperative kill of the running FFmpeg child) | no-op |
| `saveBlob(path, Blob)` | `writeFile` via `tauri-plugin-fs` | — |
| `getUniqueFilePath(path)` | Probes `exists` and appends `_2`, `_3`, … on collision | passthrough |

All Tauri modules are dynamically imported on first use so the web-only dev server never tries to resolve them.

---

## 5. Rust Backend (`src-tauri/src/lib.rs`)

Single-file backend. All commands are registered through `tauri::generate_handler!` in `run()`.

### Tauri Commands

| Command | Purpose |
|---------|---------|
| `read_config` / `save_config` | Read & write `config.json` from the per-user data dir; `save_config` runs `validate_config()` first |
| `list_compliance_files` / `list_safezone_files` | Enumerate images in the writable asset directories |
| `get_asset_dir(kind)` | Returns the absolute writable directory for `compliance` or `safezones` |
| `add_asset_file(kind, source_path)` | Copies a file into the writable asset dir, returning the new filename |
| `delete_asset_file(kind, filename)` | Removes a file, with a `starts_with` path-traversal guard |
| `create_render_session` | Creates a temp dir + session id (used by the legacy frame pipeline) |
| `encode_video_direct` | **Primary video path.** Single-pass FFmpeg filtergraph: scale → fit-mode (crop / blur / letterbox / manual) → overlay PNG → audio passthrough |
| `encode_video` | Legacy frame-extraction pipeline (kept as fallback) |
| `concat_videos(input_paths, output_path)` | FFmpeg `concat` demuxer, used for outro append |
| `cancel_render` | Marks the current `AppState` render as canceled and kills the FFmpeg child |
| `cleanup_session` | Removes the per-session temp dir |

### Validation Layer

All untrusted input passes through helpers before reaching FFmpeg or the filesystem:

- `validate_render_params(width, height, fps, bitrate, format)` — clamps numeric ranges and whitelists format strings (`mp4`, `webm`).
- `validate_media_file(path)` — checks file existence, minimum size (4 bytes), and magic bytes (JPEG, PNG, GIF, BMP, WebP/RIFF, MP4/MOV/`ftyp`, WebM/MKV/EBML, AVI, FLV, plus an SVG path-extension check).
- `validate_config(value)` — schema-checks shape and ranges before persisting (`export.image.quality` 1–100, `export.image.format` jpg/png, `export.video.fps` 1–120, `export.video.bitrate` 1–50 Mbps, template dimensions ≤ 7680×4320).

FFmpeg is invoked via the Tauri sidecar mechanism with a `Vec<String>` argv — no shell interpolation.

### Asset Directories

`writable_asset_dir(kind)` returns `<app_data_dir>/<kind>/`, creating it on first use and seeding it from the bundled `resources/<kind>/` defaults if empty (`seed_asset_dir`). This is what makes `add_asset_file` / `delete_asset_file` durable across sessions while still shipping defaults.

---

## 6. Render / Export Pipeline

### Video (preferred path: `encodeVideoDirect`)
1. **Overlay flatten:** the frontend renders all text + icon overlays to a transparent PNG via a hidden canvas.
2. **IPC:** the source video path, overlay PNG, target dimensions, fit mode, manual transform, fps, bitrate, and format are sent to `encode_video_direct`.
3. **FFmpeg filtergraph:** Rust spawns the bundled FFmpeg sidecar with a single `-filter_complex` that handles scaling, the chosen fit mode, the manual scale/offset transform, and the overlay composite — in one pass, with audio mapped through.
4. **Outro:** if an outro is configured, `concat_videos` runs a second FFmpeg pass to append it.
5. **Output path:** `getUniqueFilePath` ensures no overwrite (`_2`, `_3`, …).

### Image (`encodeStaticImage`)
1. Frontend composites source + overlays onto a `<canvas>`.
2. `canvas.toBlob()` produces JPG (q=0.9) or PNG (with alpha if Letterbox or Manual + Blur disabled).
3. The blob is written via `saveBlob` → `tauri-plugin-fs.writeFile`.

Canvas dimensions are clamped to `MAX_EXPORT_WIDTH=7680` × `MAX_EXPORT_HEIGHT=4320` on both ends of the IPC boundary.

---

## 7. Undo / Redo

Implemented inline in `App.jsx` via `React.useReducer(undoReducer, ...)`.

- **Snapshot shape:** queue, selected template/group, fit mode, manual transform, text overlays, icon overlays.
- **Actions:** `INIT`, `SET` (silent update during gestures), `COMMIT` (push to history), `UNDO`, `REDO`. Each `COMMIT` is bounded by `config.undoSteps` (default 10).
- **Gesture coalescing:** drags and continuous typing emit `SET`s during the gesture and a single `COMMIT` on release, so one undo reverses the whole motion.
- **Application loop:** when `undoState.present` changes from a UNDO/REDO action, a `useEffect` diffs it against the current snapshot and calls `applySnapshot` to fan it back out into all the individual `useState` setters. A `lastAppliedPresent` ref prevents feedback loops.
- **Shortcuts:** `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` (registered at the document level when no input is focused).

---

## 8. Permissions / Capabilities

`src-tauri/capabilities/default.json` is the source of truth for what the WebView is allowed to do. Notable grants:

- `shell:allow-execute` scoped to `binaries/ffmpeg` as a sidecar (and only that path).
- `dialog:*` for native open / save.
- `fs:*` for reading and writing across home / desktop / appdata / downloads / resource scopes (broad on purpose — the app's value prop is "save anywhere").
- `core:default` for the standard event/window APIs.

`tauri.conf.json` sets `assetProtocol.scope.allow = ["**"]` so `convertFileSrc` works for arbitrary paths the user picks. CSP is `null` because the app loads only local content.

See `docs/SECURITY_REVIEW_RESPONSE.md` for the rationale on each broad permission.

---

## 9. Testing

```bash
npm test
```

Vitest 4 runs the suites under `src/utils/__tests__/`:

- `icon-calculations.unit.test.js`, `icon-calculations.property.test.js` — sizing math
- `icon-centering.unit.test.js`, `icon-centering.property.test.js` — center positioning
- `icon-clamping.unit.test.js`, `icon-clamping.property.test.js` — minimum-width clamp
- `safe-area-color.unit.test.js` — config fallback color resolution

Property tests use `fast-check` to fuzz numeric ranges. Pure functions live in `src/utils/` precisely so they can be unit-tested without a DOM or React harness.

---

## 10. Patterns & Gotchas

- **Lazy plugin loading:** Tauri modules are dynamically `import()`-ed in `tauri-bridge.js`. Don't move them to top-level imports — it breaks `npm run dev` outside Tauri.
- **`convertFileSrc`:** required for the WebView to load any local file. Used both for media previews and for the writable asset dir.
- **Sidecar naming:** the FFmpeg binary must end with the Rust target triple (`-x86_64-pc-windows-msvc.exe`). Tauri's sidecar resolver uses that suffix to pick the right binary at runtime.
- **Resources vs public:** `public/` is for Vite dev. The production app reads from `src-tauri/resources/` (bundled) and from the per-user writable asset dir (runtime). `setup-tauri.ps1` syncs `public/` → `src-tauri/resources/`.
- **Vendored crates:** `src-tauri/vendor/` is checked in (and `.cargo/config.toml`-routed) so the build runs without network access. If you add a Rust dep, run `cargo vendor` and re-commit.
- **Single huge component:** `App.jsx` is ~167 KB. New features should at least extract their own helper module under `src/utils/` (with tests) even if the React tree stays in `App.jsx`.

---

## 11. Where Things Live — Quick Index

| Feature | Location |
|---------|----------|
| Fit-mode logic (preview) | `src/App.jsx` → `drawMediaFit` |
| Fit-mode logic (export) | `src-tauri/src/lib.rs` → `encode_video_direct` filtergraph |
| Overlay composite (preview & export) | `src/App.jsx` → `drawOverlays` |
| Undo reducer | `src/App.jsx` → `undoReducer`, `applySnapshot`, `getSnapshot` |
| Native bridge | `src/tauri-bridge.js` |
| Tauri commands | `src-tauri/src/lib.rs` |
| Validation helpers | `src-tauri/src/lib.rs` → `validate_render_params`, `validate_media_file`, `validate_config` |
| Permissions | `src-tauri/capabilities/default.json` |
| App configuration | `src-tauri/tauri.conf.json` |
| Pure icon math | `src/utils/icon-calculations.js` (+ `__tests__/`) |
| Dependencies | `docs/dependencies.md` |
| Security posture | `docs/SECURITY_REVIEW_RESPONSE.md` |

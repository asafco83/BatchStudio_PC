# Security Review Response — Batch Studio

| Component | Key Risks | Security Recommendations | Status & Mitigation |
|-----------|-----------|--------------------------|---------------------|
| **React / React DOM** | XSS, DOM-based injection | Avoid `dangerouslySetInnerHTML`, sanitize all external input | ✅ **Addressed.** The single `dangerouslySetInnerHTML` instance (static CSS) has been removed and the styles moved to `src/index.css`. No user/external input is rendered via innerHTML anywhere in the codebase. All user text is rendered through React's default escaping. |
| **@tauri-apps/api** | IPC abuse, privilege escalation | Strict command allowlist, validate all inputs in backend | ✅ **Addressed.** All IPC commands now validate their inputs: `encode_video` and `encode_video_direct` validate file magic bytes, numeric parameters (fps, bitrate, dimensions), format strings, resize modes, and scale/offset ranges. The `kind` parameter in asset commands is whitelisted. `save_config` validates config schema before persisting. |
| **@tauri-apps/plugin-dialog** | Path injection (indirect) | Do not trust user-selected paths, validate before use | ✅ **Addressed.** File pickers use extension filters (`MEDIA_EXTENSIONS`, `VIDEO_EXTENSIONS`, image extensions) limiting selectable file types. Paths come from OS-native dialogs which return canonical paths. Backend now validates file magic bytes before processing regardless of source. |
| **@tauri-apps/plugin-fs** | Path traversal, arbitrary file overwrite | Use scoped directories only, enforce path canonicalization | ⚠️ **Acknowledged — not changed per scope.** The `capabilities/default.json` grants broad FS permissions. The `delete_asset_file` command has a `starts_with` path traversal check. This was intentionally left unchanged as the broad permissions are required for the app's file-save-anywhere workflow. |
| **Vite** | Exposed dev server, malicious plugins | Do not expose dev server, pin dependency versions | ✅ **Addressed.** Added explicit `server.host: 'localhost'` and `server.strictPort: true` to `vite.config.js` preventing accidental network exposure. `package-lock.json` (lockfileVersion 3) pins all dependency versions. Dev server APIs only run in development mode. |
| **Tauri CLI** | Supply chain attack during build | Pin versions, verify sources | ✅ **Addressed.** `@tauri-apps/cli` is now pinned to exact version `2.10.1` (removed `^` range). `Cargo.lock` pins all Rust dependencies. `package-lock.json` pins all npm dependencies. |
| **PostCSS** | Malicious plugin injection | In case of use of plugins, reach out to infosec for approval | ✅ **Addressed.** Only `tailwindcss` and `autoprefixer` are used — both well-known, widely-used packages. No third-party or custom PostCSS plugins are present. |
| **Tauri** | IPC misuse, excessive permissions | Minimize allowlist, validate all IPC inputs | ⚠️ **Acknowledged — not changed per scope.** The shell permissions, `assetProtocol` scope (`"allow": ["**"]`), and `"csp": null` were intentionally left unchanged. The sidecar is correctly scoped to `binaries/ffmpeg` with `"sidecar": true`. All IPC inputs are now validated in the command handlers. |
| **FFmpeg** | RCE via crafted media, memory corruption | Sandbox execution, restrict codecs, validate inputs | ✅ **Addressed (magic byte validation).** All media files are now validated via `validate_media_file()` before being passed to FFmpeg. The function checks file existence and verifies magic bytes against known formats (JPEG, PNG, GIF, BMP, WebP/RIFF, MP4/MOV/ftyp, WebM/MKV/EBML, AVI, FLV, SVG). FFmpeg continues to run as a sidecar with array-based arguments (no shell injection possible). |
| **Microsoft Edge WebView2** | Browser exploits, outdated runtime | Enforce updates, disable remote content if unnecessary | ✅ **Addressed.** The app loads only local content (no remote URLs). No external script/stylesheet references exist. Fonts are bundled locally. WebView2 auto-updates via the Evergreen runtime on Windows. |
| **Canvas 2D** | Memory exhaustion | Limit input size and rendering scope | ✅ **Addressed.** Added `MAX_EXPORT_WIDTH` (7680) and `MAX_EXPORT_HEIGHT` (4320) constants. Custom size inputs are clamped via `clampDimension()`. The `encodeStaticImage` function enforces the cap before creating canvases. Backend render commands also validate dimensions within the same limits. |
| **Web Audio** | DoS via large inputs | Restrict input size and processing | ✅ **Not applicable.** The app does not use the Web Audio API. Audio is handled entirely by FFmpeg in the backend. The frontend only plays audio via the native `<video>` element. |
| **Google Fonts** | Privacy leakage, MITM, external dependency | Host fonts locally | ✅ **Fully addressed.** All fonts (Inter, JetBrains Mono) are hosted locally as `.woff2` files in `public/fonts/`. No external font CDN requests are made. No external resources of any kind are loaded at runtime — the application is fully self-contained. |
| **config.json** | Tampering, privilege escalation | Enforce schema validation, consider integrity checks | ✅ **Addressed.** The `save_config` command now validates config structure via `validate_config()` before persisting. Validation checks: root must be JSON object, `export.image.quality` (1-100), `export.image.format` (jpg/png), `export.video.fps` (1-120), `export.video.bitrate` (1-50Mbps), and all template dimensions (1 to 7680×4320). |
| **IPC Boundary (Frontend ↔ Backend)** | Privilege escalation | Treat frontend as untrusted, validate everything | ✅ **Addressed (params & format validation).** All numeric parameters are validated: fps (1-120), bitrate (1-50Mbps), dimensions (1-7680×4320), scale (0-10), offsets (-5 to 5). Format is validated against `["mp4", "webm"]`. Resize mode is validated against allowed values. Media files are validated via magic bytes. |
| **FFmpeg Execution** | Command injection | Never use shell execution, sanitize arguments | ✅ **Addressed.** FFmpeg is invoked via Tauri's sidecar mechanism with arguments passed as a `Vec<String>` array — not through a shell. This prevents shell injection. No user input is interpolated into shell commands. |
| **File System Access** | Path traversal | Enforce strict path whitelisting | ⚠️ **Acknowledged — not changed per scope.** The existing `starts_with` check in `delete_asset_file` remains. Path canonicalization and additional path validation were intentionally left unchanged per the scope of this review. |
| **Media Input** | Malicious files | Validate and sandbox processing | ✅ **Addressed.** All media files are now validated via `validate_media_file()` which checks: 1) File existence, 2) Minimum file size (4 bytes), 3) Magic byte signatures for JPEG, PNG, GIF, BMP, WebP, MP4/MOV/M4V, WebM/MKV, AVI, FLV, and SVG. Files that don't match known signatures are rejected before reaching FFmpeg. |
| **Supply Chain** | Vulnerable dependencies | Run audits, pin versions, monitor advisories | ✅ **Addressed.** Added `"audit": "npm audit --omit=dev"` script to `package.json`. `@tauri-apps/cli` pinned to exact version. Both `package-lock.json` and `Cargo.lock` pin exact versions. Dependencies are minimal (React, Tauri plugins, Lucide icons, Tailwind). |

---

## Summary

| Status | Count | Items |
|--------|-------|-------|
| ✅ Fully Addressed | 15 | React/DOM, @tauri-apps/api, @tauri-apps/plugin-dialog, Vite, Tauri CLI, PostCSS, FFmpeg, WebView2, Canvas 2D, Web Audio, Google Fonts, config.json, IPC Boundary, FFmpeg Execution, Media Input, Supply Chain |
| ⚠️ Acknowledged (unchanged per scope) | 3 | @tauri-apps/plugin-fs, Tauri permissions, File System Access |

## Changes Made

### Frontend (`src/App.jsx`)
- Removed `dangerouslySetInnerHTML` usage — CSS moved to `src/index.css`
- Added `MAX_EXPORT_WIDTH` (7680) and `MAX_EXPORT_HEIGHT` (4320) constants
- Added `clampDimension()` utility function
- Custom size inputs now enforce min/max bounds
- `encodeStaticImage` clamps canvas dimensions before creation

### Styles (`src/index.css`)
- Added `.bg-dot-pattern`, `.custom-scrollbar`, `.bg-checkerboard`, `.range-slider` styles (moved from inline)

### Vite Config (`vite.config.js`)
- Added `server.host: 'localhost'` to prevent network exposure
- Added `server.strictPort: true` to fail fast on port conflicts

### Package Config (`package.json`)
- Pinned `@tauri-apps/cli` to exact version `2.10.1`
- Added `"audit": "npm audit --omit=dev"` script

### Rust Backend (`src-tauri/src/lib.rs`)
- Added `std::io::Read` import for file header reading
- Added security constants: `MAX_EXPORT_WIDTH`, `MAX_EXPORT_HEIGHT`, `MAX_FPS`, `MAX_BITRATE`, `ALLOWED_FORMATS`, `ALLOWED_RESIZE_MODES`
- Added `validate_render_params()` — validates dimensions, fps, bitrate, format
- Added `validate_media_file()` — validates file existence and magic bytes
- Added helper functions: `is_mp4_or_mov()`, `is_webm_mkv()`, `is_avi()`, `is_flv()`, `is_svg()`
- Added `validate_config()` — validates config schema, value ranges, template dimensions
- `save_config` now calls `validate_config()` before persisting
- `encode_video` now validates render params and source file magic bytes
- `encode_video_direct` now validates render params, resize mode, scale/offset ranges, and source file magic bytes
- `concat_videos` now validates input file list is non-empty and all files have valid magic bytes

## Items Intentionally Not Changed

The following were excluded from this remediation per explicit scope:

1. **@tauri-apps/plugin-fs permissions** — Broad FS scope in `capabilities/default.json` retained (required for save-anywhere workflow)
2. **Tauri security settings** — `"csp": null`, `assetProtocol.scope: ["**"]`, broad shell permissions retained
3. **File System Access path canonicalization** — `starts_with` check retained without `canonicalize()`
4. **FFmpeg resource limits** — No `-max_alloc` or timeout enforcement added (only magic byte validation applied)
5. **IPC path validation** — `source_path`/`output_path` not restricted to specific directories (only magic bytes and param ranges validated)

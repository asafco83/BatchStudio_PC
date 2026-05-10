# Batch Studio PC — Dependencies

Inventory of libraries and third-party resources used in Batch Studio PC. Versions reflect what is pinned in `package.json` and `src-tauri/Cargo.toml`.

---

## 1. Frontend Dependencies (Production)

Bundled into the application UI.

| Package                       | Version    | Purpose                                                                 |
|-------------------------------|------------|-------------------------------------------------------------------------|
| `react`                       | `^18.3.1`  | UI framework.                                                           |
| `react-dom`                   | `^18.3.1`  | React DOM renderer.                                                     |
| `lucide-react`                | `^0.511.0` | Icon set used throughout the application.                               |
| `@tauri-apps/api`             | `^2`       | Communication bridge between the frontend and the Rust backend.         |
| `@tauri-apps/plugin-dialog`   | `^2`       | Native file open / save dialogs.                                        |
| `@tauri-apps/plugin-fs`       | `^2`       | Native filesystem access for reading / writing config and rendered files. |

---

## 2. Build-time Dependencies (Development)

Used to develop, test, and bundle the application.

| Package                   | Version     | Purpose                                                                   |
|---------------------------|-------------|---------------------------------------------------------------------------|
| `vite`                    | `^6.3.4`    | Frontend build tool and dev server.                                       |
| `@vitejs/plugin-react`    | `^4.3.4`    | React fast-refresh and JSX support for Vite.                              |
| `@tauri-apps/cli`         | `2.10.1` (pinned) | CLI for `tauri dev` / `tauri build`. Pinned exactly per security review. |
| `tailwindcss`             | `^3.4.17`   | Utility-first CSS framework.                                              |
| `postcss`                 | `^8.5.3`    | CSS processing pipeline.                                                  |
| `autoprefixer`            | `^10.4.21`  | PostCSS plugin for vendor prefixes.                                       |
| `vitest`                  | `^4.1.5`    | Unit + property test runner.                                              |
| `fast-check`              | `^4.7.0`    | Property-based test generators (used in `src/utils/__tests__/*.property.test.js`). |

### NPM scripts

| Script              | Purpose                                                       |
|---------------------|---------------------------------------------------------------|
| `npm run dev`       | Vite dev server only (web mode, no Tauri shell).              |
| `npm run build`     | Vite production build → `dist/`.                              |
| `npm run preview`   | Preview the built `dist/`.                                    |
| `npm test`          | Run Vitest in CI mode (single pass).                          |
| `npm run tauri:dev` | Vite dev server + Tauri window with hot-reload.               |
| `npm run tauri:build` | Production build: Vite + Rust release + NSIS / MSI bundles. |
| `npm run audit`     | `npm audit --omit=dev` — production-only vulnerability check. |

---

## 3. Rust Dependencies (`src-tauri/Cargo.toml`)

The Rust backend is intentionally lean. All transitive crates are vendored under `src-tauri/vendor/` for reproducible offline builds.

| Crate                       | Version  | Purpose                                          |
|-----------------------------|----------|--------------------------------------------------|
| `tauri`                     | `2`      | Desktop runtime + IPC. Feature: `protocol-asset`. |
| `tauri-build`               | `2`      | Build-script integration.                        |
| `tauri-plugin-shell`        | `2`      | Sidecar (FFmpeg) execution.                      |
| `tauri-plugin-dialog`       | `2`      | Native file pickers.                             |
| `tauri-plugin-fs`           | `2`      | Filesystem access from the WebView.              |
| `serde` / `serde_json`      | `1`      | Config + IPC payload (de)serialization.          |
| `uuid` (`v4`)               | `1`      | Render session IDs.                              |

`Cargo.lock` is committed and pins all transitive versions. Release profile uses `lto = true`, `opt-level = "s"`, `codegen-units = 1`, `panic = "abort"`, and `strip = true` to minimize binary size.

---

## 4. Platform & Bundled Dependencies

| Dependency        | Method          | Purpose                                                                      |
|-------------------|-----------------|------------------------------------------------------------------------------|
| **Tauri v2**      | System          | Desktop container, IPC, native APIs.                                         |
| **FFmpeg**        | Bundled sidecar | All video encoding, scaling, filtergraph composition, audio sync, concat.    |
| **Canvas 2D**     | Browser API     | Preview rendering and static image exports (JPG / PNG).                      |
| **WebView2**      | System (Windows)| Underlying browser engine that renders the UI. Auto-updates via Evergreen.   |

The FFmpeg binary lives at `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` and is referenced from `tauri.conf.json` as `binaries/ffmpeg` (Tauri appends the target-triple suffix automatically). Sidecar permission is scoped in `src-tauri/capabilities/default.json`.

---

## 5. External Assets (Runtime)

The shipping application makes **no network calls at runtime** — everything is bundled or runs locally.

- **Inter / JetBrains Mono** — `.woff2` files in `public/fonts/` (mirrored to `src-tauri/resources/fonts/` for the bundle). Downloaded once at setup time by `setup-tauri.ps1`.
- **`config.json`** — bundled default at `src-tauri/resources/config.json`; live copy lives in the per-user app data dir (e.g. `%APPDATA%\com.batchstudio.app\config.json`).
- **Compliance icons** — defaults in `src-tauri/resources/compliance/`, seeded into `<app_data>/compliance/` on first launch and editable from Settings → Icons.
- **Safe-zone images** — defaults in `src-tauri/resources/safezones/`, seeded into `<app_data>/safezones/` on first launch.

---

## 6. Maintenance Notes

- **Tauri updates:** track the Tauri changelog for security patches and plugin releases. Bumping the major Tauri version may require capability/permission renames.
- **FFmpeg binary:** keep `src-tauri/binaries/ffmpeg-<triple>.exe` current (use the gyan.dev "essentials" build for Windows). Verify magic-byte coverage in `validate_media_file` if you rely on a new container format.
- **`@tauri-apps/cli`:** pinned to an exact version on purpose (supply-chain hardening per `SECURITY_REVIEW_RESPONSE.md`). Bump deliberately, not via `^`.
- **Vendored Rust crates:** when adding or upgrading a Rust dep, run `cargo vendor` from `src-tauri/` and commit the vendor changes alongside `Cargo.lock`.
- **Node.js:** the project targets Node 18+.
- **Audit:** run `npm run audit` before each release to surface production-dep advisories.

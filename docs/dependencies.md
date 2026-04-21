# Batch Studio PC — Dependencies

Inventory of libraries and third-party resources used in Batch Studio PC.

---

## 1. Frontend Dependencies (Production)

These libraries are bundled into the application's user interface.

| Package         | Version    | Purpose                                                                                           |
|-----------------|------------|----------------------------------------------------------------------------------------------------|
| `react`         | `^18.3.1`  | UI framework.                                                                                      |
| `react-dom`     | `^18.3.1`  | Core React DOM renderer.                                                                           |
| `lucide-react`  | `^0.511.0` | Icon set used throughout the application.                                                         |
| `@tauri-apps/api`| `^2`       | Communication bridge between the frontend and the Rust backend.                                    |
| `@tauri-apps/plugin-dialog` | `^2` | Native file open/save dialogs.                                                            |
| `@tauri-apps/plugin-fs`     | `^2` | Native filesystem access for reading/writing config and saving rendered files.             |

---

## 2. Build-time Dependencies (Development)

These tools are used to develop, test, and bundle the application.

| Package                   | Version     | Purpose                                                                                                             |
|---------------------------|-------------|----------------------------------------------------------------------------------------------------------------------|
| `vite`                    | `^6.3.4`    | Frontend build tool and dev server.                                                                                  |
| `@tauri-apps/cli`         | `^2`        | Command-line tool for Tauri (build, dev, init).                                                                      |
| `tailwindcss`             | `^3.4.17`   | Utility-first CSS framework.                                                                                         |
| `postcss`                 | `^8.5.3`    | CSS processing pipeline.                                                              |
| `autoprefixer`            | `^10.4.21`  | PostCSS plugin for vendor prefixes.                                                                                  |

---

## 3. Platform & Bundled Dependencies

Batch Studio PC relies on native platform features and bundled binaries.

| Dependency | Method | Purpose |
|------------|--------|---------|
| **Tauri v2** | System | Provides the desktop container, IPC, and native API access. |
| **FFmpeg** | Bundled Binary | high-performance video encoding, filtering, and audio syncing. |
| **Canvas 2D** | Browser API | Used for preview rendering and static image exports. |
| **Web Audio** | Browser API | Used for audio preview in the UI. |
| **WebView2** | System (Windows) | The underlying browser engine that renders the application UI. |

---

## 4. External Assets (Runtime)

Files loaded from external sources or local resources at runtime.

- **Inter / JetBrains Mono:** Loaded from Google Fonts for the UI.
- **config.json:** Loaded from the application's local resource directory.
- **Compliance Icons:** Loaded from the bundled `compliance/` directory.
- **Safe Zone Images:** Loaded from the bundled `safezones/` directory.

---

## 5. Maintenance Notes

- **Tauri Updates:** Check the Tauri changelog for security patches and new plugin versions.
- **FFmpeg Binaries:** Ensure that the bundled FFmpeg binaries are kept up to date and are compatible with the target operating systems.
- **Node.js:** The project expects a modern Node.js environment (v18+).

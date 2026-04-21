# Batch Studio — Dependencies

Inventory of every external library and third-party resource this project pulls in, grouped by role (runtime / build-time / deployment / browser platform). Versions reflect `package.json` at the time of writing — check there for authoritative values.

---

## 1. Runtime dependencies (production bundle)

Everything in `package.json` → `dependencies`. These ship to the user in the built JS bundle.

| Package         | Version    | Used for                                                                                           |
|-----------------|------------|----------------------------------------------------------------------------------------------------|
| `react`         | `^18.3.1`  | UI framework — all components, hooks, state.                                                       |
| `react-dom`     | `^18.3.1`  | React's DOM renderer; `createRoot(...)` mounts `<App />` in `src/main.jsx`.                        |
| `lucide-react`  | `^0.511.0` | All icons in the UI (upload, play, settings, trash, drag handles, etc.). Imported from `App.jsx`. |

No state-management library, no router, no UI kit. That is deliberate — the app is a single view.

---

## 2. Build-time / dev dependencies

Everything in `package.json` → `devDependencies`. These run locally and at `npm run build` time; they do **not** end up in the browser bundle.

| Package                   | Version     | Used for                                                                                                             |
|---------------------------|-------------|----------------------------------------------------------------------------------------------------------------------|
| `vite`                    | `^6.3.4`    | Dev server (hot reload + the API middleware in `vite.config.js`) and production bundler (`npm run build` → `dist/`). |
| `@vitejs/plugin-react`    | `^4.3.4`    | React fast-refresh + JSX transform for Vite.                                                                          |
| `tailwindcss`             | `^3.4.17`   | Utility-class styling. Configured in `tailwind.config.js` (custom `ink` and `accent` palettes, Inter/JetBrains font stacks). |
| `postcss`                 | `^8.5.3`    | CSS post-processor pipeline Tailwind plugs into.                                                                      |
| `autoprefixer`            | `^10.4.21`  | PostCSS plugin that adds vendor prefixes (`-webkit-`, `-moz-`) during build. Configured in `postcss.config.js`.       |

### Scripts they power

- `npm run dev` → `vite` — dev server with HMR and the dev-only API middleware.
- `npm run build` → `vite build` — static production bundle into `dist/`.
- `npm run preview` → `vite preview` — serves the built bundle locally for smoke-testing.

---

## 3. Browser-platform APIs (no package — shipped by the browser)

These aren't npm dependencies, but the render pipeline cannot function without them. If a browser lacks one, the app degrades or fails.

| API                                       | Used in                                  | Purpose                                                                                  |
|-------------------------------------------|------------------------------------------|------------------------------------------------------------------------------------------|
| **Canvas 2D** (`HTMLCanvasElement.getContext('2d')`) | `drawOverlays`, `drawMediaFit`, `encodeVideoOnCanvas`, `encodeStaticImage` | Every pixel the user exports is drawn here.                                              |
| `canvas.captureStream(fps)`               | `encodeVideoOnCanvas`                    | Turns the canvas into a `MediaStream` for `MediaRecorder`.                               |
| `canvas.toBlob(mime, quality)`            | `encodeStaticImage`                      | Produces the final JPG/PNG blob for static image exports.                                |
| `MediaRecorder`                           | `encodeVideoOnCanvas`                    | Encodes the captured stream into MP4 (Chrome/Edge) or WebM (others).                     |
| `MediaRecorder.isTypeSupported(mime)`     | `encodeVideoOnCanvas`                    | Runtime feature-detection for `video/mp4` and `video/webm; codecs=vp9`.                  |
| **Web Audio** — `AudioContext`, `createMediaElementSource`, `createMediaStreamDestination` | `encodeVideoOnCanvas` | Extracts the source video's audio track and feeds it into the recorder without routing it to the speakers. |
| `URL.createObjectURL` / `revokeObjectURL` | Upload + download flows                  | Wraps `File` inputs and export `Blob`s as URLs the app can reference.                    |
| `ResizeObserver`                          | `PreviewCanvas`, `DraggableText`         | Fits the preview to the viewport and detects text overflow.                              |
| Pointer Events (`setPointerCapture`)      | Manual-mode drag in `PreviewCanvas`      | Keeps the drag alive when the pointer leaves the element.                                |
| `File` / drag-and-drop                    | `handleDrop`, `handleFileUpload`         | Ingests user-provided videos/images.                                                     |
| CSS `containerType: inline-size` + `cqw` units | `DraggableText`, `drawOverlays`          | Makes text sizing responsive to the preview canvas without JS recalculation.             |
| `fetch`                                   | `useConfig`, `SettingsModal`             | Loads `/config.json` and talks to the `/api/*` endpoints.                                |

---

## 4. External assets loaded at runtime

The deployed page fetches a small number of files from outside the built bundle.

| Resource                         | Origin                       | Used for                                                                                         |
|----------------------------------|------------------------------|--------------------------------------------------------------------------------------------------|
| **Inter** + **JetBrains Mono**   | `fonts.googleapis.com` (CSS) + `fonts.gstatic.com` (WOFF2) | Declared in `index.html` via `<link rel="stylesheet">` and `<link rel="preconnect">`. Inter is the UI sans-serif; JetBrains Mono is used for monospaced chips (dimensions, durations, ratios). |
| `/config.json`                   | Same origin                  | Loaded once on boot by `useConfig()`. Defines templates, compliance icons, export defaults.       |
| `/compliance/*`                  | Same origin                  | Compliance badge images referenced by icon overlays (URLs built from `complianceIconsBaseUrl`).   |
| `/safezones/*`                   | Same origin                  | Safe-zone preview overlays referenced by `template.safeAreaImage`.                                |
| `/api/compliance-files`          | Same origin                  | Settings → Compliance Icons — auto-populates entries from the `compliance/` folder.              |
| `/api/safezone-files`            | Same origin                  | Settings → Output Templates — populates the "Safe Zone Image" dropdown.                           |
| `/api/save-config` (POST)        | Same origin                  | Settings → Save — writes the edited config back to `config.json`.                                 |

> If you self-host the fonts or disable external requests, drop the Google Fonts `<link>` tags in `index.html` and add equivalent `@font-face` declarations pointing at local files.

---

## 5. Server-side / deployment dependencies

These power the `/api/*` endpoints in production. They are **not** installed via npm — they're deployed as-is from `----files to be added to Dist after build/`.

| Component                       | Requires                                       | Used for                                                                                           |
|---------------------------------|------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `api/compliance-files.php`      | PHP ≥ 7.0 (any shared-host PHP will do)         | `scandir()` on `public/compliance/`, returns JSON list of image files.                             |
| `api/safezone-files.php`        | PHP ≥ 7.0                                       | Same, against `public/safezones/`.                                                                 |
| `api/save-config.php`           | PHP ≥ 7.0 + write permission on `config.json`   | Persists the Settings modal's edited JSON. Requires `chmod 644` (→ `666` if writes fail).           |
| `.htaccess`                     | Apache + `mod_rewrite`                          | Rewrites `/api/<name>` → `/api/<name>.php` and provides the SPA fallback to `index.html`.          |

### Dev-mode equivalent
`vite.config.js` defines a `saveConfigPlugin` Vite plugin that intercepts the same three `/api/*` routes using Node's `fs` module — purely so Settings → Save works without PHP locally. See `docs/DEVELOPERS.md` §6 for the contracts.

### Hosts without PHP
If you deploy to GitHub Pages / Netlify free / S3, the three endpoints are absent. List endpoints silently return `[]`; `save-config` fails with a visible error in the Settings modal. Options: ship `config.json` as-is (edit via PR), or re-implement the three endpoints as serverless functions.

---

## 6. Version bump / maintenance notes

- `lucide-react` ships icons as tree-shaken React components — upgrading usually just requires verifying any removed/renamed exports in `App.jsx`'s top-level import list.
- Tailwind v3 → v4 is a breaking upgrade (config format changed); the current setup targets v3.
- Vite 6 → 7 will likely require `@vitejs/plugin-react` to bump in lock-step.
- `MediaRecorder` MP4 support in Chromium is stable as of ~2024; older Edge (pre-Chromium) won't produce MP4 — no action needed unless you still target those.
- The PHP files have no framework or Composer dependencies; any PHP 7+ runtime works.

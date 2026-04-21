# Batch Studio — Developer Documentation

Technical reference for working on the Batch Studio codebase.

---

## 1. Stack and architecture at a glance

- **Frontend:** React 18 + Vite 6 + Tailwind 3
- **Icons:** `lucide-react`
- **Fonts:** Inter + JetBrains Mono (loaded from Google Fonts)
- **Build output:** fully static (HTML + JS + CSS + assets) — works on any static host
- **Video encode:** browser-native Canvas 2D + `MediaRecorder` on `canvas.captureStream()`, with a Web Audio `MediaStreamDestination` providing the audio track — no WebAssembly, no FFmpeg, no server
- **Image encode:** browser-native Canvas 2D + `canvas.toBlob()` for JPG/PNG output — same overlay pipeline as video
- **Persistence:** a single `config.json` in `public/`; in dev, written via Vite middleware; in production, written via PHP endpoints

Everything except the PHP endpoints runs entirely client-side. Source media never leaves the browser.

### Single-file frontend

**`src/App.jsx`** holds the entire application — all components, hooks, and the render pipeline (~2600 lines). This is intentional for now; splitting it is fine when a clear boundary emerges, but don't split for its own sake.

`src/main.jsx` is just the React root bootstrap. `src/index.css` imports Tailwind and defines a handful of base/utility styles.

---

## 2. Project structure

```
.
├── src/
│   ├── App.jsx              # Entire app
│   ├── main.jsx             # React root
│   └── index.css            # Tailwind entry + base/utilities
├── public/
│   ├── config.json          # Persisted config (templates, icons, export defaults)
│   ├── compliance/          # Compliance icon images (svg/png/…)
│   └── safezones/           # Safe-zone preview images
├── dist/                    # Build output (vite build)
├── ----files to be added to Dist after build/
│   ├── .htaccess            # Apache rewrites — copy into dist/ post-build
│   └── api/                 # PHP replacements for the dev endpoints
│       ├── compliance-files.php
│       ├── safezone-files.php
│       └── save-config.php
├── docs/
│   ├── USER_GUIDE.md
│   ├── DEVELOPERS.md        # You are here
│   └── dependencies.md      # External libs/resources used in dev + prod
├── index.html               # HTML entry (Google Fonts preconnect + <div id="root">)
├── vite.config.js           # Vite + dev-only API middleware
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## 3. Getting started

```bash
npm install
npm run dev        # Vite dev server with hot reload + dev API middleware
npm run build      # Static production build into dist/
npm run preview    # Preview the production build locally
```

No environment variables, no backend process, no DB. The dev server on `localhost:5173` serves `public/` and exposes three API routes (see §6).

---

## 4. Top-level component layout (App.jsx)

| Entity                       | Kind        | Purpose                                                                                     |
|------------------------------|-------------|---------------------------------------------------------------------------------------------|
| `useConfig()`                | hook        | GETs `/config.json`, exposes `{ config, loading, error, saveConfig }`                       |
| `ColorInput`                 | component   | Color picker + alpha slider                                                                 |
| `NumberInput`                | component   | Number input with custom up/down spinner                                                    |
| `PaddingInput`               | component   | Linked/unlinked 4-side padding control                                                      |
| `getAlignStyles()`           | helper      | Maps alignment enum to CSS/canvas style                                                     |
| `preloadIcons()`             | helper      | Preloads compliance icon `<img>` elements before canvas draw                                |
| `drawOverlays()`             | helper      | Paints text + icon overlays onto a canvas (used by both video and image exports)            |
| `drawMediaFit()`              | helper       | Draws a source (video frame or image) onto ctx using the chosen fit mode                   |
| `encodeStaticImage()`        | helper      | Renders a single image entry to a JPG/PNG blob                                              |
| `WYSIWYGVideoEditor` / `App` | component   | Root component; owns all state; exported as default                                         |
| `PreviewCanvas`              | component   | Live preview + playback controls (play/pause/seek/volume); handles video or image source   |
| `DraggableText`              | component   | Text overlay: drag/resize handles, overflow detection, inline edit                          |
| `DraggableIcon`              | component   | Compliance icon overlay: drag/resize with aspect-lock and minWidth                          |
| `SettingsModal`              | component   | Three-tab config editor (icons + templates + export)                                        |
| `VideoIcon`                  | component   | Small inline SVG used in the header title                                                   |

Use Grep to find these by name — approximate line numbers drift as the file changes.

---

## 5. State model

All top-level state lives in `WYSIWYGVideoEditor`. Key slices:

### Config / templates
- `config` — parsed `config.json`
- `selectedTemplateGroup`, `selectedTemplateId` — identifies active template
- `customSize` `{ width, height }` — used when the "Custom" template is picked

### Media queue
- `videos` — array of `{ id, file, url, name, type, width, height, duration, status, progress }`. Despite the name, entries can be either videos or static images, distinguished by `type: 'video' | 'image'`. Images have `duration: 0`.
- `selectedVideoId` — currently previewed entry
- `outroFile` — optional `{ file, url, name }` appended to every **video** export. Skipped for image entries.

### Preview / fit
- `resizeMode` — `'crop' | 'blur' | 'black' | 'manual'` (the `'black'` id corresponds to the "Letterbox" label in the UI)
- `manualTransform` — `{ scale, offsetX, offsetY, blur }` for manual mode (offsets are expressed as fractions of canvas size). Reset automatically when the template changes.
- `showSafeZone` — toggles the red dashed safe-area overlay

### Overlays
- `textOverlays` — see shape below
- `iconOverlays` — see shape below
- `selectedTextId`, `selectedIconId` — mutually exclusive: selecting one clears the other

### Render lifecycle
- `renderState` — `{ isRendering, isComplete, stats: { total, success, failed, cancelled } }`
- `cancelRef` (ref, not state) — flipped to `true` to interrupt a running render

### UI toggles
- `settingsOpen`
- `leftTab` — `'layout' | 'content'` for the left-sidebar tab switcher

### Overlay shapes

```js
// textOverlays[i]
{
  id, text,
  x, y, width, height,     // percentages of canvas
  fontSize,                // percent of canvas width (responsive, uses cqw units)
  padding,                 // { top, right, bottom, left, linked } — cqw-relative
  color, bgColor,          // #rrggbbaa strings
  align,                   // 'left' | 'center' | 'right' | 'justify-left' | 'justify-center' | 'justify-right'
  fontWeight, isItalic, fontFamily,
  letterSpacing, lineHeight,
  shadow,                  // 'none' | 'drop' | 'outline'
  borderRadius,
}

// iconOverlays[i]
{
  id, url,
  x, y, width,             // percentages of canvas (height auto-derived from aspect ratio)
  opacity,                 // 0–100
  minWidth,                // pixels, enforced during resize
  _nw, _nh,                // natural width/height cached from <img> onLoad
}
```

Overlay positions are in **percentages of the canvas**, not pixels — this is what makes them resolution-independent between preview and export.

---

## 6. API endpoints

Three endpoints power server-side persistence and file listing. There are **two implementations**: Vite middleware (dev) and PHP (production).

### In development — `vite.config.js`

| Route                    | Method | Purpose                                     |
|--------------------------|--------|---------------------------------------------|
| `/api/compliance-files`  | GET    | List image files in `public/compliance/`    |
| `/api/safezone-files`    | GET    | List image files in `public/safezones/`     |
| `/api/save-config`       | GET    | Healthcheck (`{ ok: true }`)                |
| `/api/save-config`       | POST   | Writes JSON body to `public/config.json`    |

### In production — PHP under `dist/api/`

The three PHP files reproduce the same contracts. `dist/.htaccess` rewrites `/api/<name>` → `/api/<name>.php` so the frontend's `fetch('/api/…')` calls work unchanged.

```apache
RewriteRule ^api/compliance-files/?$ api/compliance-files.php [L]
RewriteRule ^api/safezone-files/?$  api/safezone-files.php  [L]
RewriteRule ^api/save-config/?$     api/save-config.php     [L]
# SPA fallback:
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

`save-config.php` requires write permission on `dist/config.json` (after deploy: usually chmod 644, bump to 666 if writes fail).

### Frontend callers
Search for `fetch('/api/` in `src/App.jsx`. All three endpoints fail gracefully if unreachable — the list endpoints return `[]` and the config save surfaces a visible error in the settings modal.

### Hosts without PHP
If you're deploying to something truly static (GitHub Pages, Netlify free, S3), you have two options:
1. Strip the save/list API calls and ship `config.json` as-is. Users can't edit settings from the UI; updates become a deploy step.
2. Replace the three endpoints with serverless functions (Netlify Functions, Cloudflare Workers, Vercel API routes). Contracts are trivial.

---

## 7. Render / export pipeline

There are two export functions — the main loop in `startRender()` dispatches on `vid.type`:

- **`encodeVideoOnCanvas(...)`** — for `type: 'video'`. Uses `MediaRecorder` on a `canvas.captureStream()` in real time, with audio captured via Web Audio.
- **`encodeStaticImage(...)`** — for `type: 'image'`. Paints a single canvas frame and exports via `canvas.toBlob()`.

Both paths share the overlay pipeline via module-level helpers:
- `preloadIcons(icons)` — resolves to `icons` enriched with a loaded `imgElement` (same-origin so canvas never taints).
- `drawOverlays(ctx, cW, cH, texts, loadedIcons)` — paints text + icons onto the canvas.
- `drawMediaFit(ctx, source, sW, sH, cW, cH, mode, manualXform)` — draws a video frame or `<img>` with the chosen fit mode.

### Video flow (`encodeVideoOnCanvas`)

1. **Preload icon `<img>` elements** via `preloadIcons(...)`.
2. **Create a detached `<canvas>`** sized to the template (e.g. 1080×1920).
3. **Create a detached `<video>`** bound to the source blob URL, `playsInline`, `crossOrigin='anonymous'`. It is *not* `muted` — see audio step.
4. **Audio routing (Web Audio):** create an `AudioContext`, wrap the `<video>` in a `MediaElementAudioSourceNode`, pipe it into a `MediaStreamAudioDestinationNode`. **Deliberately NOT connected to `audioCtx.destination`** — this suppresses speaker output while still producing a capturable audio track. If `createMediaElementSource` throws (e.g. on tainted sources), audio is skipped and a warning is logged; video still records.
5. **Build the output stream:** `canvas.captureStream(fps)` → add the audio track from the audio destination → feed into `MediaRecorder`.
6. **Pick the MIME type** from `config.export.video.preferredFormat`:
   - `auto` (default): `video/mp4` if supported (Chrome/Edge), else `video/webm; codecs=vp9`, else `video/webm`.
   - `webm`: skip MP4 even if available.
7. **`drawFrame()` RAF loop** composites every frame:
   - Clear to black
   - Draw video according to fit mode (`crop` / `blur` / `black` / `manual`)
   - Call `drawOverlays(...)` for text + icons (skipped during outro playback)
   - Report progress (0–90 % for main video, 90–99 % for outro)
8. **Outro:** when the main video ends, if an outro is set, the `<video>` `src` is swapped to the outro and playback resumes. Overlays are suppressed during outro frames.
9. **Resolve** with `{ blob, extension }`. Caller creates an object URL, triggers a download, revokes the URL. The `AudioContext` is closed in `recorder.onstop`.

### Image flow (`encodeStaticImage`)

1. **Preload icon `<img>` elements** via `preloadIcons(...)`.
2. **Load the source image** as an `HTMLImageElement`.
3. **Create a detached `<canvas>`** sized to the template.
4. If the target format is JPG, fill black (JPG has no alpha). For PNG, skip the fill so untouched pixels stay transparent.
5. `drawMediaFit(...)` to draw the image with the chosen fit mode, then `drawOverlays(...)` for text + icons.
6. **Export via `canvas.toBlob(mime, quality)`**, where `mime` and `quality` come from `config.export.image`:
   - `format: 'jpg'` → `image/jpeg` with `quality/100` (default 0.9)
   - `format: 'png'` → `image/png`, quality parameter omitted. Transparency is preserved in `black` (letterbox) and in `manual` with Blur BG off, since those fit modes don't cover the whole canvas. `crop`/`blur` fully paint the canvas so alpha is effectively opaque. Source images with alpha (transparent PNGs) keep their alpha through `drawImage`.
7. **Resolve** with `{ blob, extension }`. No outro, no progress ticks — image export is effectively instant.

### Fit-mode math (inside `drawMediaFit`)

Given canvas `cW×cH`, source `sW×sH`:

```
ratioW = cW / sW
ratioH = cH / sH
```

| Mode     | Scale used                         | Offsets                          |
|----------|------------------------------------|----------------------------------|
| crop     | `Math.max(ratioW, ratioH)`         | centered                         |
| black    | `Math.min(ratioW, ratioH)`         | centered (Letterbox)             |
| blur     | contain scale for main, max-scale blurred layer behind at α=0.5, blur(30px) | centered |
| manual   | `Math.min(ratioW, ratioH) * scale` | `offsetX * cW`, `offsetY * cH`   |

Manual mode's `offsetX`/`offsetY` are fractions of canvas size so the same transform works at any resolution. The same helper is called from the video `drawFrame` RAF loop and from `encodeStaticImage`.

### Things the encoder does NOT do

- No frame-accurate seeking. Encoding runs in real time — a 60 s clip takes ~60 s.
- No WebCodecs. Sticking with `MediaRecorder` for broad support.
- No GPU-accelerated filters. The `blur(30px)` is a `ctx.filter` string; performance varies by browser.

### Cancellation

`cancelRef.current = true` is checked at the top of each frame. When tripped, the `MediaRecorder` is stopped, the promise rejects with a cancellation marker, the queue loop catches the error and skips remaining items, and `renderState.stats.cancelled` increments.

---

## 8. Preview canvas internals

`PreviewCanvas` is deliberately NOT used for the actual export — it's just DOM. It mirrors the same math so what you see is what you get.

Key behaviors:

- **ResizeObserver** on the outer wrapper fits the canvas to the viewport while preserving aspect ratio.
- **Manual drag**: `pointerdown` on the canvas container captures the pointer. Drag deltas are divided by canvas width/height so the offset state stays fractional.
- **Click-outside deselect**: `handleCanvasPointerDown` checks `containerRef.current.contains(e.target)` — clicks in the padded area around the canvas fall through to clear `selectedTextId` / `selectedIconId`.
- **No mouse-wheel scaling**: the wheel handler was intentionally removed (users found it too twitchy). Scale is slider-only.
- **Video element itself is `pointer-events: none`** so clicks pass through to overlays.
- **Playback controls** (below the canvas, video only): play/pause, click-to-seek scrubber, mute toggle, volume slider. Preview starts muted (`isMuted = true`) so opening a video doesn't blast audio. The preview volume has **no effect on the exported file** — audio is always captured from the source element via Web Audio.

---

## 9. Overlay internals

### DraggableText

- Owns two pointer-interaction modes: **drag** (top handle, visible when selected) and **resize** (bottom-right corner handle).
- Uses window-level `pointermove` / `pointerup` listeners while active so the drag continues even if the pointer leaves the element.
- Renders text inside a `<textarea>` using `cqw` container-query units, which makes font size responsive to the preview canvas size without manual recalculation. Typing in the textarea directly updates the overlay's `text` field.
- A `ResizeObserver` on the textarea detects when the rendered text overflows its box and flips an overflow warning icon on.

### DraggableIcon

- Same pointer model as `DraggableText`.
- Aspect ratio is locked from the image's `naturalWidth` / `naturalHeight` — resizing by width auto-computes height via CSS (`height: auto`).
- `_nw` / `_nh` are cached on the overlay when the `<img>` loads, so the sidebar can show the calculated output dimensions.
- If the icon has a `minWidth` in config, resizing below that is clamped (converted to percentage at resize time using the live canvas width). `minHeight` is stored but not currently enforced by the resize handle.

### Why percentages, not pixels
Both overlays store positions/sizes as percentages of the canvas. This means:
- Preview and export produce identical layouts.
- Switching templates (e.g. 1080×1920 → 1080×1080) keeps overlays proportionally placed instead of jumping off-screen.

---

## 10. Config schema (`public/config.json`)

```jsonc
{
  "complianceIconsBaseUrl": "/compliance/",

  "export": {
    "image": {
      "format": "jpg",            // "jpg" | "png"
      "quality": 90               // 1–100, JPG only (ignored for PNG)
    },
    "video": {
      "preferredFormat": "auto",  // "auto" | "webm"
      "bitrate": 8000000,         // bits per second
      "fps": 30
    }
  },

  "complianceIcons": [
    {
      "filename": "GamCare+18_Black.svg",
      "label": "GamCare +18 Black",
      "minHeight": null,          // stored but not enforced at resize
      "minWidth": null            // pixels, enforced during resize
    }
  ],

  "templates": {
    "Instagram": [
      {
        "id": "ig-stories",
        "name": "Stories / Reels",
        "width": 1080,
        "height": 1920,
        "ratio": "9:16",
        "safeAreaImage": "MetaAds-reels-9x16.png",
        "safeArea": {
          "top": "10%", "bottom": "20%", "left": "5%", "right": "5%"
        }
      }
    ],
    "YouTube":   [ /* ... */ ],
    "Facebook":  [ /* ... */ ],
    "TikTok":    [ /* ... */ ],
    "LinkedIn":  [ /* ... */ ],
    "Twitter":   [ /* ... */ ],
    "Custom":    [ /* ... */ ]
  }
}
```

Notes:
- `export` is optional — if absent from an old deployed `config.json`, the encoders fall back to JPG 90 / MP4-auto 8 Mbps / 30 fps. The Settings → Export tab fills in the same defaults when first opened.
- `safeArea` values are CSS strings (`"10%"`, `"60px"`) — they're applied as `style.top` etc. directly. `safeArea` itself is optional; a template can have only `safeAreaImage` and no dashed rectangle.
- `minWidth` / `minHeight` on icons are integers in pixels or `null`.
- `safeAreaImage` is optional — path is relative to `public/safezones/`.
- The "Custom" group is treated specially: its first template id is `custom` and drives the width/height number inputs in the sidebar.

### Editing the config
- UI: Settings modal → posts JSON to `/api/save-config`.
- Manually: edit `public/config.json` directly in dev, or `dist/config.json` on the server in production.
- New files dropped into `public/compliance/` auto-populate the icon list when the Settings modal opens (default `minWidth: 40`, `minHeight: 40`).

---

## 11. Building and deploying

### Local dev
```bash
npm run dev
```

### Production build
```bash
npm run build
```
Outputs a fully static site to `dist/`.

> **⚠️ Careful:** `vite build` wipes `dist/` on every run, including the `.htaccess` and three `api/*.php` files needed for production. Keep copies in `----files to be added to Dist after build/` (the repo already does) and re-add them after each build, or script the copy in a post-build step.

### Deployment targets

**Static hosts with PHP (e.g. InfinityFree, most shared hosting)**
1. Run `npm run build`.
2. Re-add `.htaccess` and `api/*.php` to `dist/` from `----files to be added to Dist after build/`.
3. Upload the contents of `dist/` to the host's web root (e.g. `htdocs/`).
4. chmod `config.json` to `644` (bump to `666` if saves fail).

See `docs/USER_GUIDE.md` §9 for end-user-facing notes.

**Static hosts without PHP (GitHub Pages, Netlify free tier, S3, etc.)**
The save/list endpoints won't exist. The app still works, but:
- The two list endpoints return `[]` and nothing breaks — however, compliance icons and safe-zone images must already be referenced by `config.json` at deploy time; they can't be discovered at runtime.
- Saving settings from the UI will fail. Either disable the settings UI, or replace the three endpoints with serverless functions.

---

## 12. Patterns and gotchas for new contributors

- **Monolithic `App.jsx`**: expected for now. Prefer inline edits over premature module splitting.
- **Refs over state** for things that don't need re-renders: manual drag tracking, render cancellation, intermediate video DOM elements, drag-drop source indices in settings.
- **Pointer capture**: manual drag uses `setPointerCapture` on the wrapper so drags continue across overlays/edges. Text/icon overlays use window-level `pointermove` / `pointerup` listeners for the same reason.
- **`cqw` units**: the overlay container sets `containerType: 'inline-size'`, enabling container queries for text sizing and cqw-based padding. Inspector quirks in older browsers can make these look unresponsive even when they work.
- **Canvas taint**: icons are preloaded as `Image()` and only drawn after `onload`. Don't introduce cross-origin icon URLs unless they send CORS headers. The video element sets `crossOrigin='anonymous'` so that remote sources with proper CORS can be both drawn and audio-captured.
- **Audio capture quirk**: `AudioContext.createMediaElementSource` can only wrap a given element once. If you reassign the video element's `src` mid-session, the existing source node is reused (Chrome/Edge) — swapping to the outro works because the source node sees the new stream automatically.
- **Browser codec differences**: Chrome/Edge produce MP4, Firefox/Safari produce WebM. The detection is in `encodeVideoOnCanvas`. If you need consistent output, post-process externally.
- **Global CSS**: Base and utility styles live in `src/index.css` (Tailwind `@layer base` / `@layer utilities`). A few component-scoped styles are injected via `dangerouslySetInnerHTML` inside the root render (dot pattern background, custom scrollbar, checkerboard for transparency previews, range slider thumb). Everything else is Tailwind.
- **Dev vs prod API**: remember there are two implementations that must stay in sync — `vite.config.js` middleware and `dist/api/*.php`. If you add a fourth endpoint, add both **and** the `.htaccess` rewrite rule.
- **Progress reporting**: the render loop reports via `onProgress` — don't block the main thread in that callback or frames drop.

---

## 13. Where things live — quick index

| Want to change…                             | File, roughly…                             |
|--------------------------------------------|--------------------------------------------|
| Fit-mode math (video + image)               | `App.jsx` → `drawMediaFit` helper          |
| Preview fit-mode math                       | `App.jsx` → `PreviewCanvas` → `manualVideoStyle` / media `style` prop |
| Video export format / bitrate / fps         | `App.jsx` → `encodeVideoOnCanvas` MIME detection (reads `config.export.video`) |
| Video audio capture                         | `App.jsx` → `encodeVideoOnCanvas` (`AudioContext` + `MediaStreamDestination`) |
| Image export format / quality               | `App.jsx` → `encodeStaticImage` (reads `config.export.image`) |
| Text word-wrap / justification              | `App.jsx` → `drawOverlays` helper          |
| Icon resize clamping                        | `App.jsx` → `DraggableIcon`                |
| Click-outside deselect                      | `App.jsx` → `PreviewCanvas.handleCanvasPointerDown` |
| Media type detection / intake               | `App.jsx` → `processNewFiles` (`type: 'video' | 'image'`) |
| Render dispatch (image vs video)            | `App.jsx` → `startRender` → branches on `vid.type` |
| Preview playback controls                   | `App.jsx` → `PreviewCanvas` (play/pause/seek/volume/mute) |
| Template presets                            | `public/config.json`                       |
| Export defaults (image/video)               | `public/config.json` → `export.*`          |
| Compliance icons                            | `public/compliance/` + `public/config.json`|
| Safe-zone preview images                    | `public/safezones/` + `safeAreaImage` in config |
| Dev-only API                                | `vite.config.js`                           |
| Production API                              | `----files to be added to Dist after build/api/*.php` + `.htaccess` |
| Root styles                                 | `src/index.css`                            |
| Injected component CSS (scrollbar, etc.)    | `App.jsx` — look for `dangerouslySetInnerHTML` |
| External libs / resources inventory         | `docs/dependencies.md`                     |

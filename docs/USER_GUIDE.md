# Batch Studio — User Guide

A browser-based editor for repurposing a single source video **or static image** into multiple platform-sized outputs (Instagram, TikTok, YouTube, etc.) with text, icon overlays, and compliance badges baked into the exported file.

Everything runs in your browser. Source files are never uploaded to a server — they're processed locally.

---

## 1. Quick start

1. Open the app in a modern browser (Chrome/Edge recommended — best codec support for MP4 export).
2. **Upload** one or more videos or images via the upload button or drag-and-drop anywhere on the canvas area.
3. Pick a **platform template** (e.g. Instagram → Stories/Reels 9:16).
4. Pick a **fit mode** (how the media fills the new aspect ratio).
5. Add **text** and **compliance icons** if needed, position them by dragging.
6. Click **Render** to export. Files download automatically.

The left sidebar has two tabs:
- **Layout** — output template, custom size, and fit strategy.
- **Content** — text/icon overlays plus the optional global outro.

---

## 2. Uploading media

- Click the **+** button in the queue header (top-right) or drag files onto the central preview area.
- Both **videos** (MP4, WebM, MOV, etc.) and **static images** (JPG, PNG, WebP, etc.) are accepted.
- Multiple files can be queued at once — they render sequentially. Images and videos can be mixed freely in the queue.
- The app reads each file's dimensions automatically (and duration for videos). If metadata can't be read, a video falls back to assumed defaults (1920×1080, 10s) after ~1.5s; images fall back similarly.
- Entries appear in the right-hand queue list and show the dimensions plus either the duration (for videos) or an "IMG" tag (for stills). Click any entry to preview it.
- Remove an entry from the queue with its trash icon (hover the row to reveal).

### Preview playback controls (videos only)

When a video is selected, a control strip appears under the canvas:
- **Play / Pause** the preview loop.
- **Scrubber** — click anywhere on the bar to seek.
- **Volume slider + mute toggle** — controls preview audio only. Rendering always captures audio from the source regardless of the preview volume.

### Outro (optional, videos only)
You can attach a single "outro" video that will be appended to the end of every rendered **video** output — useful for consistent branding or call-to-action tails. Static images skip the outro and are exported as-is.

---

## 3. Choosing an output size

The editor ships with editable presets grouped by platform:

| Platform   | Examples                                               |
|------------|--------------------------------------------------------|
| Instagram  | Stories/Reels 9:16, Feed 4:5, Square 1:1, Profile      |
| YouTube    | Shorts 9:16, Video 16:9, Thumbnail, Channel Cover      |
| Facebook   | Stories/Reels, Square, Feed Image, Cover               |
| TikTok     | Video 9:16, Profile                                    |
| LinkedIn   | Ads Square, Post Image, Company Cover, Personal Cover  |
| Twitter/X  | In-Feed Image, Header Photo                            |
| Custom     | Enter any width × height                               |

Pick a platform group first, then a preset within that group. Custom lets you type exact pixel dimensions. Groups and presets can be reordered / added / removed in Settings → Output Templates.

The preview updates instantly. The dark area is the final canvas — anything outside it is cropped away on export.

---

## 4. Fit modes

Once the output aspect ratio is different from your source media, the editor needs to decide what to do with the leftover space. Four modes apply equally to videos and static images:

| Mode          | What happens                                                                                         |
|---------------|------------------------------------------------------------------------------------------------------|
| **Crop**      | Scales the media to completely fill the canvas. Parts of it are clipped at the edges.                |
| **Blur**      | Scales to fit inside the canvas; the empty area is filled with a blurred, dimmed copy of the media.  |
| **Letterbox** | Scales to fit inside the canvas. Empty area stays solid black (or transparent for PNG export).       |
| **Manual**    | Place and scale the media yourself — drag inside the frame to pan, use the scale slider.             |

### Manual mode details
- **Drag inside the preview** to pan the video.
- **Scale slider** in the side panel controls zoom (0.1× to 5×).
- **Blur BG** toggle: keep a blurred fill behind your repositioned media, or turn it off to leave black/transparent.
- **Reset Pos** returns the offset to centre (keeping the current blur setting). Scale resets automatically when you switch templates.
- The mouse wheel does **not** change scale — use the slider.
- Clicking in the empty padded area *around* the frame deselects any active text or icon overlay.

---

## 5. Text overlays

Click **Add Text** (Content tab) to create a new text box on the canvas.

**Editing the text**
- Click any text overlay to select it — an editor panel appears in the side panel.
- Type directly into the overlay in the preview — it's a live textarea.
- Drag the top handle (visible when selected) to move; drag the bottom-right corner to resize.

**Text properties you can change**
- Text content
- Font family (system font list)
- Weight (100 / 300 / 400 / 500 / 600 / 700 / 900)
- Italic toggle
- Size (percentage of the output canvas width — stays responsive)
- Line height, letter spacing
- Color + opacity
- Background color + opacity
- Padding (all four sides, linked or unlinked)
- Alignment: left, center, right — plus three justify variants (justify with last line L / C / R)
- Shadow: none, drop shadow, or black outline

**Overflow warning**
If text is too large to fit inside its box, a small red warning icon appears on the overlay. Either increase the box size or shrink the font / padding.

---

## 6. Icon (compliance badge) overlays

Icons come from the files in your `public/compliance/` folder and are listed in the app's config.

Click **Add Icon** (Content tab) to place the first configured icon. A 4-column picker lets you switch to any other configured icon.

**Icon properties**
- Opacity slider (0–100 %)
- Drag the top handle to move, drag the bottom-right corner to resize
- Aspect ratio is locked to the source image
- Some icons have a **minimum width** configured — you can't shrink them below that (useful for regulatory badges that must stay legible)

---

## 7. Safe zones

Many platforms overlay their own UI (like-button, caption, profile pic) on top of your video. Safe zones show where that UI lives so you don't place your text under it.

- Toggle the safe-zone overlay on/off from the "Safe zone" button in the top-center of the canvas area (only shown when the selected template has a safe-zone image).
- When on, a dashed red rectangle marks the safe area (if `safeArea` insets are configured).
- Templates may also have a reference image (e.g. a TikTok UI mockup) that overlays for visual guidance.

The safe zone is **preview-only** — it's never drawn into the exported file.

---

## 8. Rendering and export

- Click **Render** (top-right) to start encoding. Every queued entry is processed one after another.
- A progress bar per entry shows progress (0–100 %). Images finish almost instantly; videos encode in real time.
- Exports are automatically downloaded as files named `<original>_processed.<ext>`.
- Resolution matches the template you picked (e.g. 1080 × 1920 for Stories).

**Video outputs**
- Output format is **MP4** if your browser supports MP4 recording (Chrome, Edge). Otherwise **WebM (VP9)**, or plain WebM as a last-resort fallback.
- Frame rate and bitrate are configurable in Settings → Export (defaults 30 fps / 8 Mbps).
- **Audio** from the source video is recorded into the exported file (the preview is muted by default so you don't hear it while editing). If the source has no audio track, the output is video-only.
- If an outro video is attached, it's appended to the end of every video output.

**Static image outputs**
- Output format defaults to **JPG at 90 % quality**; switch to **PNG (24-bit + alpha)** in Settings → Export if you need lossless output.
- PNG always ignores the quality slider.
- PNG preserves transparency: in **Letterbox** (or **Manual** with Blur BG off) the empty area around the image is exported as transparent instead of black bars. In **Crop** / **Blur** the whole canvas is covered so there's no transparent area to preserve. JPG always uses black since it has no alpha channel.
- Static images are never wrapped in a video container — the file you download has the same format you configured.
- Outros do **not** apply to static images.

**Cancelling a render**
Click **Cancel** (top-right, replaces the Render button while rendering). The currently encoding entry is stopped; remaining queued entries are skipped.

**Render stats**
When the queue finishes, a summary modal shows total / succeeded / failed / cancelled counts.

---

## 9. Settings (admin)

The gear icon (top-right, next to Render) opens the Settings modal. Three tabs:

### Compliance Icons
- Edit the **label** shown in the picker for each icon.
- Set **minimum width** and/or **minimum height** constraints (in pixels). Only `minWidth` is currently enforced by the resize handle.
- Edit the **Base URL** used when constructing icon URLs (defaults to `/compliance/`).
- New image files dropped into `public/compliance/` on the server appear here automatically so you can configure them. Entries for files not found in the folder are shown with a yellow warning border.
- Save writes back to `public/config.json`.

### Output Templates
- Reorder platform groups (drag the grip handle next to each group name).
- Reorder templates within a group (drag the grip handle on each template row).
- Edit name, width, height, aspect ratio label.
- Configure safe-area insets (top / bottom / left / right as CSS strings like `"10%"` or `"60px"`).
- Assign a safe-zone preview image from `public/safezones/`.
- Add new groups, add new templates, delete templates. The built-in "Custom" group can't be deleted.

### Export
Controls how rendered files are saved.

**Static Image Export**
- **Format:** JPG or PNG (24-bit + alpha). Default JPG.
- **Quality:** 1–100 %, JPG only. Default 90. Ignored for PNG.

**Video Export**
- **Format:** *Auto* (prefer MP4 when the browser supports it, otherwise WebM) or *Force WebM*. Default Auto.
- **Bitrate:** target video bitrate in Mbps. Default 8.
- **FPS:** canvas capture framerate. Default 30.
- Firefox and Safari always fall back to WebM regardless of the preference — MP4 `MediaRecorder` output simply isn't available there.

Changes take effect after saving.

> **Note on production hosting:** On static hosts (e.g. InfinityFree) the Save action requires the PHP backend endpoints under `api/` to be deployed and `config.json` to be writable. If saving fails, you likely need to raise file permissions to `666` on `config.json`. See the deployment section of the developer docs.

---

## 10. Keyboard tips

There are no global hotkeys. In the "Add Group" input (Settings → Output Templates sidebar), `Enter` confirms the new group name and `Escape` cancels.

---

## 11. Troubleshooting

**Video won't upload / preview is black**
Some codecs (e.g. H.265/HEVC, ProRes) aren't supported in browsers. Re-encode the source as H.264 MP4.

**Image looks fine in preview but export is grainy**
JPG at 90 % is a good default, but if you need lossless output (e.g. UI mockups, charts, flat colors) switch to PNG in Settings → Export.

**Exported file is WebM instead of MP4**
Your browser doesn't support MP4 `MediaRecorder` output (Firefox, Safari). Use Chrome or Edge, or convert the WebM externally.

**No audio in the exported video**
Either the source video has no audio track, or the browser blocked audio capture for this source (e.g. due to `crossOrigin` failures on non-local URLs). Local file uploads should always capture audio successfully.

**Text looks clipped at export time**
The overflow warning icon catches most cases; double-check before rendering, especially at smaller template sizes.

**Render is slow**
Rendering runs in real-time (frame-by-frame, synced to video playback). A 60-second clip takes ~60 seconds to encode per output.

**Saving settings fails**
Either the PHP `save-config` endpoint isn't reachable, or `config.json` isn't writable. Check permissions or contact whoever hosts the deployment.

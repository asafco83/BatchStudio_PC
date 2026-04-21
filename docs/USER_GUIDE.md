# Batch Studio PC — User Guide

A powerful desktop video editor for repurposing a single source video **or static image** into multiple platform-sized outputs (Instagram, TikTok, YouTube, etc.) with text, icon overlays, and compliance badges.

Everything runs locally on your PC. Files are processed using a high-performance FFmpeg-native pipeline, and your data remains private and offline.

---

## 1. Quick start

1. **Launch** the Batch Studio application on your Windows PC.
2. **Import Media** by clicking the **+** button in the queue header or by dragging files anywhere onto the application window.
3. Pick a **Platform Template** (e.g., Instagram → Stories/Reels 9:16).
4. Pick a **Fit Mode** (how the media fills the chosen aspect ratio).
5. Add **Text** or **Compliance Icons** if needed, positioning them by dragging on the canvas.
6. Click **Render** to process. Output files are saved automatically to your machine.

---

## 2. Importing Media

- **Native Dialogs:** Use the **+** button to open a native Windows file picker.
- **Native Drag-and-Drop:** Drag files directly from File Explorer into the Batch Studio window.
- **Supported Formats:** MP4, WebM, MOV, AVI, JPG, PNG, WebP, etc.
- **Mixing Media:** You can mix videos and images in the same render queue.
- **Entry Management:** Each item in the queue shows dimensions and type. Click an entry to preview it, or use the trash icon to remove it.

### Preview Controls
When a video is selected, use the bottom control strip to:
- **Play / Pause** the preview loop.
- **Seek** using the scrubber bar.
- **Adjust Volume** or mute the preview audio (this does not affect the final render).

### Global Outro
You can pick a single **Outro Video** to be appended to the end of every rendered video in your queue. Static images skip this step.

---

## 3. Fit Modes

Batch Studio provides four ways to handle aspect ratio mismatches:

| Mode          | Description                                                                                          |
|---------------|------------------------------------------------------------------------------------------------------|
| **Crop**      | Scales media to fill the entire canvas, clipping edges if necessary.                                 |
| **Blur**      | Fits media inside the canvas and fills the background with a blurred, dimmed version of the media.   |
| **Letterbox** | Fits media inside the canvas with solid black bars (or transparency for PNG).                        |
| **Manual**    | Complete control: use the **Scale slider** and drag inside the preview to pan/zoom.                  |

---

## 4. Text & Icon Overlays

### Text
- **Add Text:** Click the button in the Content tab to place a new text box.
- **Edit:** Double-click to type directly on the canvas.
- **Styling:** Customize font, weight, size, color, background, alignment, and shadow/outline in the side panel.
- **Responsive:** Text sizes are relative to the canvas width, ensuring consistent results at any output resolution.

### Icons (Compliance Badges)
- **Add Icon:** Choose from a list of pre-configured compliance badges.
- **Constraints:** Some icons have a configured minimum width to ensure they remain legible for regulatory compliance.
- **Positioning:** Drag to move, and use the corner handles to resize while maintaining the original aspect ratio.

---

## 5. Rendering and Export

Batch Studio PC uses a high-performance **FFmpeg-native** engine for video processing.

- **Progress:** Watch real-time progress bars as each entry in the queue is rendered.
- **Automatic Naming:** Processed files are saved as `<original>_processed.<ext>`.
- **Duplicate Prevention:** If a file with the same name already exists in the output folder, Batch Studio will automatically append a number (e.g., `_2`) to prevent overwrites.

### Video Export
- **Formats:** MP4 (preferred) or WebM.
- **Configurable:** Adjust target bitrate and FPS in Settings → Export.
- **Audio:** Source audio is preserved and synced perfectly using the native pipeline.

### Static Image Export
- **Formats:** JPG (at 90% quality) or PNG (24-bit with alpha).
- **Transparency:** PNG exports preserve transparent backgrounds in Letterbox and Manual (with Blur disabled) modes.

---

## 6. Settings (Administration)

Click the gear icon to customize your workflow:

### Compliance Icons
- Manage your library of regulatory badges.
- Set label names and minimum size constraints.
- Icons are loaded from the local `resources/compliance/` directory.

### Output Templates
- Create custom width/height presets.
- Configure **Safe Zones** (e.g., for TikTok/Reels UI) to ensure overlays don't get covered by platform interface elements.

### Export Settings
- Define default bitrates, frame rates, and image quality levels for all renders.

---

## 7. Troubleshooting

- **Video Ingestion Fails:** Ensure the file is not corrupted. Most common codecs are supported via FFmpeg.
- **Render is Slow:** While FFmpeg is fast, high-resolution encoding is resource-intensive. Ensure your PC has adequate ventilation and power.
- **Audio Mismatch:** If your source video has non-standard audio sampling, FFmpeg will attempt to normalize it, but verify the output for complex audio tracks.
- **Settings Not Saving:** In the desktop app, settings are saved to a local `config.json`. Ensure the application has permission to write to its own directory.


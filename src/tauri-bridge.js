/**
 * tauri-bridge.js
 * Abstraction layer between the React UI and the Tauri / web backends.
 * Every export checks `isTauri` at runtime and delegates to either the
 * Tauri IPC commands or the original fetch-based web endpoints.
 *
 * Tauri packages are loaded via dynamic import so the web-only dev server
 * (`npm run dev`) never tries to resolve them at startup.
 */

export const isTauri =
  typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

// ---------------------------------------------------------------------------
// Lazy-loaded Tauri modules (only resolved when isTauri is true)
// ---------------------------------------------------------------------------

let _core = null;
let _dialog = null;
let _fs = null;
let _window = null;

async function core() {
  if (!_core) {
    console.log('[Bridge] Lazy-loading @tauri-apps/api/core...');
    _core = await import('@tauri-apps/api/core');
    console.log('[Bridge] @tauri-apps/api/core loaded.');
  }
  return _core;
}
async function dialog() {
  if (!_dialog) _dialog = await import('@tauri-apps/plugin-dialog');
  return _dialog;
}
async function fsPlugin() {
  if (!_fs) _fs = await import('@tauri-apps/plugin-fs');
  return _fs;
}
async function windowApi() {
  if (!_window) _window = await import('@tauri-apps/api/window');
  return _window;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export async function loadConfig() {
  if (isTauri) {
    try {
      const { invoke } = await core();
      return await invoke('read_config');
    } catch (err) {
      console.warn('Tauri read_config failed, falling back to fetch:', err);
      return fetch('/config.json').then((r) => r.json());
    }
  }
  return fetch('/config.json').then((r) => r.json());
}

export async function persistConfig(config) {
  if (isTauri) {
    const { invoke } = await core();
    return invoke('save_config', { config });
  }
  const res = await fetch('/api/save-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Failed to save');
}

// ---------------------------------------------------------------------------
// File Listing
// ---------------------------------------------------------------------------

export async function getComplianceFiles() {
  if (isTauri) {
    const { invoke } = await core();
    return invoke('list_compliance_files');
  }
  return fetch('/api/compliance-files')
    .then((r) => r.json())
    .catch(() => []);
}

export async function getSafezoneFiles() {
  if (isTauri) {
    const { invoke } = await core();
    return invoke('list_safezone_files');
  }
  return fetch('/api/safezone-files')
    .then((r) => r.json())
    .catch(() => []);
}

// ---------------------------------------------------------------------------
// File Picking
// ---------------------------------------------------------------------------

const MEDIA_EXTENSIONS = [
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'flv',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg',
];

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'flv'];

/**
 * Open a native file-picker for media files.
 * @returns {Promise<string[]|null>} Array of absolute file paths, or null.
 */
export async function pickMediaFiles() {
  if (!isTauri) return null;
  const { open } = await dialog();
  const result = await open({
    multiple: true,
    filters: [{ name: 'Media Files', extensions: MEDIA_EXTENSIONS }],
  });
  if (!result) return null;
  // `open` returns a string (single) or string[] (multi)
  return Array.isArray(result) ? result : [result];
}

/**
 * Open a native file-picker for a single video file (outro).
 * @returns {Promise<string|null>} Absolute file path or null.
 */
export async function pickVideoFile() {
  if (!isTauri) return null;
  const { open } = await dialog();
  const result = await open({
    multiple: false,
    filters: [{ name: 'Video Files', extensions: VIDEO_EXTENSIONS }],
  });
  return result || null;
}

/**
 * Open a native save-file dialog.
 * @param {string} defaultName - Suggested file name.
 * @returns {Promise<string|null>} Chosen save path or null.
 */
export async function pickSaveLocation(defaultName) {
  if (!isTauri) return null;
  const { save } = await dialog();
  return save({ defaultPath: defaultName });
}

/**
 * Open a native folder-picker (for choosing output directory).
 * @returns {Promise<string|null>}
 */
export async function pickOutputFolder() {
  if (!isTauri) return null;
  const { open } = await dialog();
  return open({ directory: true });
}

// ---------------------------------------------------------------------------
// Preview URLs
// ---------------------------------------------------------------------------

/**
 * Convert an absolute file path to a URL the WebView can load.
 */
export async function getPreviewUrl(filePath) {
  console.log(`[Bridge] getPreviewUrl for: ${filePath}`);
  if (isTauri) {
    try {
      const c = await core();
      if (c && c.convertFileSrc) {
        const url = c.convertFileSrc(filePath);
        console.log(`[Bridge] convertFileSrc success: ${url}`);
        return url;
      }
    } catch (err) {
      console.warn('[Bridge] convertFileSrc import failed:', err);
    }
    
    if (window.__TAURI_INTERNALS__) {
      const { convertFileSrc } = window.__TAURI_INTERNALS__;
      if (convertFileSrc) {
        const url = convertFileSrc(filePath);
        console.log(`[Bridge] convertFileSrc fallback success: ${url}`);
        return url;
      }
    }
    const fallback = `https://asset.localhost/${encodeURIComponent(filePath)}`;
    console.log(`[Bridge] Using hardcoded fallback: ${fallback}`);
    return fallback;
  }
  return filePath; // Already a blob or http URL in web mode
}

// ---------------------------------------------------------------------------
// Drag-and-Drop (Tauri window-level)
// ---------------------------------------------------------------------------

/**
 * Register a listener for Tauri file drops. Returns an unlisten function.
 * @param {(paths: string[]) => void} onDrop - Called with the dropped file paths.
 * @returns {Promise<() => void>} Unlisten function.
 */
export async function setupDragDrop(onDrop) {
  if (!isTauri) return () => {};
  try {
    const { getCurrentWindow } = await windowApi();
    const win = await getCurrentWindow();
    
    console.log('[SetupSync] Registering window drag-drop listener...');
    
    return win.onDragDropEvent((event) => {
      if (event.payload.type === 'drop') {
        const paths = event.payload.paths || [];
        console.log('[NativeDrop] Paths received:', paths);
        if (paths.length > 0) onDrop(paths);
      }
    });
  } catch (err) {
    console.error('[SetupSync] Failed to set up drag-drop:', err);
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Render Pipeline
// ---------------------------------------------------------------------------

export async function createRenderSession() {
  const { invoke } = await core();
  return invoke('create_render_session');
}

export async function writeFrame(tempDir, frameIndex, jpegBuffer) {
  const { writeFile } = await fsPlugin();
  const num = String(frameIndex).padStart(5, '0');
  const framePath = `${tempDir}\\frame_${num}.jpg`;
  await writeFile(framePath, jpegBuffer);
}

export async function encodeVideoCmd(params) {
  const { invoke } = await core();
  return invoke('encode_video', params);
}

export async function encodeVideoDirect(params) {
  const { invoke } = await core();
  return invoke('encode_video_direct', params);
}

export async function concatVideos(inputPaths, outputPath) {
  const { invoke } = await core();
  return invoke('concat_videos', { inputPaths, outputPath });
}

export async function cleanupSession(sessionId) {
  const { invoke } = await core();
  return invoke('cleanup_session', { sessionId });
}

// ---------------------------------------------------------------------------
// File Saving
// ---------------------------------------------------------------------------

export async function saveBlob(outputPath, blob) {
  const { writeFile } = await fsPlugin();
  const buffer = new Uint8Array(await blob.arrayBuffer());
  await writeFile(outputPath, buffer);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Unique File Paths (avoid overwriting)
// ---------------------------------------------------------------------------

export async function getUniqueFilePath(filePath) {
  if (!isTauri) return filePath;
  const { exists } = await fsPlugin();
  if (!await exists(filePath)) return filePath;

  const lastDot = filePath.lastIndexOf('.');
  const base = lastDot > 0 ? filePath.slice(0, lastDot) : filePath;
  const ext = lastDot > 0 ? filePath.slice(lastDot) : '';

  let counter = 2;
  while (counter < 1000) {
    const candidate = `${base}_${counter}${ext}`;
    if (!await exists(candidate)) return candidate;
    counter++;
  }
  return `${base}_${Date.now()}${ext}`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function getExtension(filePath) {
  return filePath.split('.').pop().toLowerCase();
}

export function getFileName(filePath) {
  return filePath.split(/[\\/]/).pop();
}

export function getMediaType(filePath) {
  const ext = getExtension(filePath);
  const videoExts = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'flv']);
  return videoExts.has(ext) ? 'video' : 'image';
}

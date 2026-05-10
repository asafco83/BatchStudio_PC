use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

struct RenderSession {
    temp_dir: PathBuf,
}

pub struct AppState {
    sessions: Mutex<HashMap<String, RenderSession>>,
    active_ffmpeg: Mutex<Option<CommandChild>>,
}

// ---------------------------------------------------------------------------
// Security: Input Validation
// ---------------------------------------------------------------------------

/// Maximum allowed export dimensions (8K) to prevent resource exhaustion.
const MAX_EXPORT_WIDTH: u32 = 7680;
const MAX_EXPORT_HEIGHT: u32 = 4320;
/// Maximum allowed FPS.
const MAX_FPS: u32 = 120;
/// Maximum allowed bitrate (50 Mbps).
const MAX_BITRATE: u64 = 50_000_000;
/// Allowed video output formats.
const ALLOWED_FORMATS: &[&str] = &["mp4", "webm"];
/// Allowed resize modes.
const ALLOWED_RESIZE_MODES: &[&str] = &["blur", "crop", "fill", "black", "fit", "manual"];

/// Validate numeric render parameters are within sane ranges.
fn validate_render_params(width: u32, height: u32, fps: u32, bitrate: u64, format: &str) -> Result<(), String> {
    if width == 0 || width > MAX_EXPORT_WIDTH {
        return Err(format!("Width must be between 1 and {MAX_EXPORT_WIDTH}, got {width}"));
    }
    if height == 0 || height > MAX_EXPORT_HEIGHT {
        return Err(format!("Height must be between 1 and {MAX_EXPORT_HEIGHT}, got {height}"));
    }
    if fps == 0 || fps > MAX_FPS {
        return Err(format!("FPS must be between 1 and {MAX_FPS}, got {fps}"));
    }
    if bitrate == 0 || bitrate > MAX_BITRATE {
        return Err(format!("Bitrate must be between 1 and {MAX_BITRATE}, got {bitrate}"));
    }
    if !ALLOWED_FORMATS.contains(&format) {
        return Err(format!("Format must be one of {:?}, got '{format}'", ALLOWED_FORMATS));
    }
    Ok(())
}

/// Validate that a file exists and its magic bytes match known media formats.
/// This prevents processing of crafted/malicious files that masquerade as media.
fn validate_media_file(path: &str) -> Result<(), String> {
    let p = PathBuf::from(path);
    if !p.exists() {
        return Err(format!("File does not exist: {path}"));
    }

    let mut file = fs::File::open(&p).map_err(|e| format!("Cannot open file: {e}"))?;
    let mut header = [0u8; 12];
    let bytes_read = file.read(&mut header).map_err(|e| format!("Cannot read file header: {e}"))?;

    if bytes_read < 4 {
        return Err("File too small to be valid media".to_string());
    }

    // Check magic bytes for known media formats
    let is_valid = matches!(
        &header[..4],
        // JPEG
        [0xFF, 0xD8, 0xFF, _] |
        // PNG
        [0x89, 0x50, 0x4E, 0x47] |
        // GIF87a / GIF89a
        [0x47, 0x49, 0x46, 0x38] |
        // BMP
        [0x42, 0x4D, _, _] |
        // RIFF container (WebP or AVI — further checked below)
        [0x52, 0x49, 0x46, 0x46]
    ) || is_mp4_or_mov(&header, bytes_read)
      || is_webm_mkv(&header, bytes_read)
      || is_avi(&header, bytes_read)
      || is_flv(&header, bytes_read)
      || is_svg(&p);

    if !is_valid {
        return Err(format!("File does not appear to be a valid media file: {path}"));
    }

    Ok(())
}

fn is_mp4_or_mov(header: &[u8; 12], len: usize) -> bool {
    if len < 8 { return false; }
    // ftyp box: bytes 4-7 should be "ftyp"
    &header[4..8] == b"ftyp"
    // moov box at start (some MOV files)
    || &header[4..8] == b"moov"
    // mdat box at start
    || &header[4..8] == b"mdat"
    // wide box (older QuickTime)
    || &header[4..8] == b"wide"
    // free box
    || &header[4..8] == b"free"
}

fn is_webm_mkv(header: &[u8; 12], len: usize) -> bool {
    if len < 4 { return false; }
    // EBML header (WebM/MKV)
    header[0] == 0x1A && header[1] == 0x45 && header[2] == 0xDF && header[3] == 0xA3
}

fn is_avi(header: &[u8; 12], len: usize) -> bool {
    if len < 12 { return false; }
    // RIFF....AVI
    &header[0..4] == b"RIFF" && &header[8..12] == b"AVI "
}

fn is_flv(header: &[u8; 12], len: usize) -> bool {
    if len < 3 { return false; }
    // FLV signature
    &header[0..3] == b"FLV"
}

fn is_svg(path: &PathBuf) -> bool {
    // SVG files are text-based; check extension and first bytes for XML/SVG markers
    let ext = path.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if ext != "svg" { return false; }
    // Read first 256 bytes to check for SVG markers
    if let Ok(mut f) = fs::File::open(path) {
        let mut buf = [0u8; 256];
        if let Ok(n) = f.read(&mut buf) {
            let content = String::from_utf8_lossy(&buf[..n]).to_lowercase();
            return content.contains("<svg") || content.contains("<?xml");
        }
    }
    false
}

/// Validate config.json structure and value ranges.
fn validate_config(config: &serde_json::Value) -> Result<(), String> {
    // Must be an object
    let obj = config.as_object().ok_or("Config must be a JSON object")?;

    // Validate export settings if present
    if let Some(export) = obj.get("export") {
        if let Some(image) = export.get("image") {
            if let Some(quality) = image.get("quality") {
                let q = quality.as_u64().unwrap_or(0);
                if q == 0 || q > 100 {
                    return Err(format!("export.image.quality must be 1-100, got {q}"));
                }
            }
            if let Some(format) = image.get("format") {
                let f = format.as_str().unwrap_or("");
                if !["jpg", "png"].contains(&f) {
                    return Err(format!("export.image.format must be 'jpg' or 'png', got '{f}'"));
                }
            }
        }
        if let Some(video) = export.get("video") {
            if let Some(fps) = video.get("fps") {
                let f = fps.as_u64().unwrap_or(0);
                if f == 0 || f > MAX_FPS as u64 {
                    return Err(format!("export.video.fps must be 1-{MAX_FPS}, got {f}"));
                }
            }
            if let Some(bitrate) = video.get("bitrate") {
                let b = bitrate.as_u64().unwrap_or(0);
                if b == 0 || b > MAX_BITRATE {
                    return Err(format!("export.video.bitrate must be 1-{MAX_BITRATE}, got {b}"));
                }
            }
        }
    }

    // Validate templates if present
    if let Some(templates) = obj.get("templates") {
        if let Some(tpl_obj) = templates.as_object() {
            for (group, items) in tpl_obj {
                if let Some(arr) = items.as_array() {
                    for item in arr {
                        if let Some(w) = item.get("width") {
                            let wv = w.as_u64().unwrap_or(0) as u32;
                            if wv == 0 || wv > MAX_EXPORT_WIDTH {
                                return Err(format!(
                                    "Template '{group}' has invalid width {wv} (max {MAX_EXPORT_WIDTH})"
                                ));
                            }
                        }
                        if let Some(h) = item.get("height") {
                            let hv = h.as_u64().unwrap_or(0) as u32;
                            if hv == 0 || hv > MAX_EXPORT_HEIGHT {
                                return Err(format!(
                                    "Template '{group}' has invalid height {hv} (max {MAX_EXPORT_HEIGHT})"
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

/// Return the path to `config.json` inside the writable data directory.
/// On first launch the default config is copied from the bundled resources.
fn ensure_config(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?;
    let target = dir.join("config.json");

    if !target.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

        // 1) Try bundled resource (production)
        if let Ok(res) = app.path().resource_dir() {
            let src = res.join("config.json");
            if src.exists() {
                let _ = fs::copy(&src, &target);
                return Ok(target);
            }
        }
        // 2) Fall back to dev working directory
        if let Ok(cwd) = std::env::current_dir() {
            for base in [cwd.join("public"), cwd.join("..").join("public")] {
                let src = base.join("config.json");
                if src.exists() {
                    let _ = fs::copy(&src, &target);
                    return Ok(target);
                }
            }
        }
        // 3) Write an empty default so we don't crash
        fs::write(&target, "{}").map_err(|e| e.to_string())?;
    }
    Ok(target)
}

fn list_images(dir: &PathBuf) -> Vec<String> {
    const EXTS: &[&str] = &["png", "jpg", "jpeg", "svg", "webp", "gif"];
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
            EXTS.contains(&ext.as_str()).then_some(name)
        })
        .collect()
}

/// Probe writability by attempting to create + delete a tiny file.
fn is_writable(dir: &PathBuf) -> bool {
    if fs::create_dir_all(dir).is_err() {
        return false;
    }
    let probe = dir.join(".batchstudio_write_probe");
    if fs::write(&probe, b"x").is_ok() {
        let _ = fs::remove_file(&probe);
        true
    } else {
        false
    }
}

/// Seed a directory from the bundled resources / dev `public/` folder if
/// it's currently empty.
fn seed_asset_dir(app: &AppHandle, target: &PathBuf, sub: &str) {
    let already_has_files = fs::read_dir(target)
        .map(|it| it.flatten().next().is_some())
        .unwrap_or(false);
    if already_has_files {
        return;
    }
    if let Ok(res) = app.path().resource_dir() {
        let src = res.join(sub);
        if src.exists() {
            if let Ok(entries) = fs::read_dir(&src) {
                for entry in entries.flatten() {
                    let to = target.join(entry.file_name());
                    let _ = fs::copy(&entry.path(), &to);
                }
                return;
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        for base_dir in [cwd.join("public").join(sub), cwd.join("..").join("public").join(sub)] {
            if base_dir.exists() {
                if let Ok(entries) = fs::read_dir(&base_dir) {
                    for entry in entries.flatten() {
                        let to = target.join(entry.file_name());
                        let _ = fs::copy(&entry.path(), &to);
                    }
                }
                return;
            }
        }
    }
}

/// Returns the writable asset directory for a given subfolder
/// (e.g. "compliance", "safezones").
///
/// Strategy:
/// 1. Prefer the folder next to the running executable (portable layout —
///    so a portable .zip can be moved around and stay self-contained).
/// 2. Fall back to the per-user app-data dir when the exe folder is
///    read-only (e.g. an installed app under Program Files).
///
/// The directory is seeded from the bundled resources on first use.
fn writable_asset_dir(app: &AppHandle, sub: &str) -> Result<PathBuf, String> {
    // 1) Portable: <exe_dir>/<sub>
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let candidate = parent.join(sub);
            if is_writable(&candidate) {
                seed_asset_dir(app, &candidate, sub);
                return Ok(candidate);
            }
        }
    }

    // 2) Installed: app_data_dir/<sub>
    let base = data_dir(app)?;
    let target = base.join(sub);
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    seed_asset_dir(app, &target, sub);
    Ok(target)
}

// ---------------------------------------------------------------------------
// Commands — Config
// ---------------------------------------------------------------------------

#[tauri::command]
fn read_config(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = ensure_config(&app)?;
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_config(app: AppHandle, config: serde_json::Value) -> Result<(), String> {
    // Validate config structure and value ranges before persisting
    validate_config(&config)?;
    let path = ensure_config(&app)?;
    let pretty = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Commands — File Listing
// ---------------------------------------------------------------------------

#[tauri::command]
fn list_compliance_files(app: AppHandle) -> Vec<String> {
    writable_asset_dir(&app, "compliance")
        .map(|d| list_images(&d))
        .unwrap_or_default()
}

#[tauri::command]
fn list_safezone_files(app: AppHandle) -> Vec<String> {
    writable_asset_dir(&app, "safezones")
        .map(|d| list_images(&d))
        .unwrap_or_default()
}

#[tauri::command]
fn get_asset_dir(app: AppHandle, kind: String) -> Result<String, String> {
    let sub = match kind.as_str() {
        "compliance" => "compliance",
        "safezones" => "safezones",
        _ => return Err(format!("Unknown asset kind: {kind}")),
    };
    let dir = writable_asset_dir(&app, sub)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn add_asset_file(app: AppHandle, kind: String, source_path: String) -> Result<String, String> {
    let sub = match kind.as_str() {
        "compliance" => "compliance",
        "safezones" => "safezones",
        _ => return Err(format!("Unknown asset kind: {kind}")),
    };
    let dir = writable_asset_dir(&app, sub)?;
    let src = PathBuf::from(&source_path);
    let file_name = src
        .file_name()
        .ok_or_else(|| "Invalid source path".to_string())?
        .to_string_lossy()
        .to_string();

    // Ensure unique destination filename
    let mut dest = dir.join(&file_name);
    if dest.exists() {
        let stem = src.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        let ext = src.extension().map(|s| format!(".{}", s.to_string_lossy())).unwrap_or_default();
        let mut counter = 2;
        loop {
            let candidate = dir.join(format!("{stem}_{counter}{ext}"));
            if !candidate.exists() {
                dest = candidate;
                break;
            }
            counter += 1;
            if counter > 9999 { break; }
        }
    }

    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.file_name().unwrap().to_string_lossy().to_string())
}

#[tauri::command]
fn delete_asset_file(app: AppHandle, kind: String, filename: String) -> Result<(), String> {
    let sub = match kind.as_str() {
        "compliance" => "compliance",
        "safezones" => "safezones",
        _ => return Err(format!("Unknown asset kind: {kind}")),
    };
    let dir = writable_asset_dir(&app, sub)?;
    let target = dir.join(&filename);
    // Disallow path traversal
    if !target.starts_with(&dir) {
        return Err("Invalid filename".to_string());
    }
    if target.exists() {
        fs::remove_file(&target).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands — Render Pipeline
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct SessionInfo {
    session_id: String,
    temp_dir: String,
}

#[tauri::command]
fn create_render_session(state: State<'_, AppState>) -> Result<SessionInfo, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let dir = std::env::temp_dir().join(format!("batchstudio_{}", &id[..8]));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    state
        .sessions
        .lock()
        .unwrap()
        .insert(id.clone(), RenderSession { temp_dir: dir.clone() });

    Ok(SessionInfo {
        session_id: id,
        temp_dir: dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
async fn encode_video(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    source_path: String,
    output_path: String,
    fps: u32,
    format: String,
    bitrate: u64,
    render_audio: bool,
) -> Result<String, String> {
    // Validate render parameters
    validate_render_params(1920, 1080, fps, bitrate, &format)?;
    // Validate source media file magic bytes
    validate_media_file(&source_path)?;

    let temp_dir = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .ok_or("Render session not found")?
            .temp_dir
            .clone()
    };

    let frame_pattern = temp_dir.join("frame_%05d.jpg");

    let mut args: Vec<String> = vec![
        "-y".into(),
        "-framerate".into(),
        fps.to_string(),
        "-i".into(),
        frame_pattern.to_string_lossy().to_string(),
    ];

    // Add source as second input for audio extraction
    if render_audio {
        args.extend([
            "-i".into(),
            source_path.clone(),
            "-map".into(),
            "0:v".into(),
            "-map".into(),
            "1:a?".into(),
        ]);
    }

    // Codec settings
    if format == "webm" {
        args.extend([
            "-c:v".into(),
            "libvpx-vp9".into(),
            "-crf".into(),
            "30".into(),
            "-b:v".into(),
            bitrate.to_string(),
        ]);
        if render_audio {
            args.extend([
                "-c:a".into(),
                "libopus".into(),
                "-b:a".into(),
                "128k".into(),
            ]);
        }
    } else {
        args.extend([
            "-c:v".into(),
            "libx264".into(),
            "-preset".into(),
            "medium".into(),
            "-crf".into(),
            "18".into(),
            "-b:v".into(),
            bitrate.to_string(),
            "-maxrate".into(),
            bitrate.to_string(),
            "-bufsize".into(),
            (bitrate * 2).to_string(),
            "-pix_fmt".into(),
            "yuv420p".into(),
        ]);
        if render_audio {
            args.extend(["-c:a".into(), "aac".into(), "-b:a".into(), "192k".into()]);
        }
    }

    args.extend(["-shortest".into(), output_path.clone()]);

    let (mut rx, child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("FFmpeg sidecar not found: {e}"))?
        .args(&args)
        .spawn()
        .map_err(|e| format!("FFmpeg execution failed: {e}"))?;

    // Store child handle so cancel_render can kill it
    {
        let state = app.state::<AppState>();
        let mut guard = state.active_ffmpeg.lock().unwrap();
        *guard = Some(child);
    }

    let mut stderr_buf = Vec::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => stderr_buf.extend_from_slice(&line),
            CommandEvent::Terminated(payload) => {
                let state = app.state::<AppState>();
                let mut guard = state.active_ffmpeg.lock().unwrap();
                *guard = None;

                if payload.code != Some(0) {
                    return Err(format!(
                        "FFmpeg encode failed (exit {:?}):\n{}",
                        payload.code,
                        String::from_utf8_lossy(&stderr_buf)
                    ));
                }
                break;
            }
            _ => {}
        }
    }

    Ok(output_path)
}

/// FFmpeg-native pipeline: resize + overlay in one pass (much faster than frame extraction).
#[tauri::command]
async fn encode_video_direct(
    app: AppHandle,
    source_path: String,
    overlay_path: String,
    output_path: String,
    resize_mode: String,
    width: u32,
    height: u32,
    scale: f64,
    offset_x: f64,
    offset_y: f64,
    use_blur: bool,
    fps: u32,
    format: String,
    bitrate: u64,
    render_audio: bool,
) -> Result<String, String> {
    // Validate render parameters
    validate_render_params(width, height, fps, bitrate, &format)?;
    // Validate resize mode
    if !ALLOWED_RESIZE_MODES.contains(&resize_mode.as_str()) {
        return Err(format!("Invalid resize mode: '{}'. Allowed: {:?}", resize_mode, ALLOWED_RESIZE_MODES));
    }
    // Validate scale and offset ranges
    if scale <= 0.0 || scale > 10.0 {
        return Err(format!("Scale must be between 0 and 10, got {scale}"));
    }
    if offset_x < -5.0 || offset_x > 5.0 || offset_y < -5.0 || offset_y > 5.0 {
        return Err(format!("Offset values must be between -5 and 5, got ({offset_x}, {offset_y})"));
    }
    // Validate source media file magic bytes
    validate_media_file(&source_path)?;

    let w = width;
    let h = height;

    // Build resize filter based on mode
    eprintln!("[BatchStudio] encode_video_direct: resize_mode='{}', {}x{}, scale={}, offset=({},{}), blur={}", 
              resize_mode, w, h, scale, offset_x, offset_y, use_blur);
    let resize_filter = match resize_mode.as_str() {
        "blur" => {
            // Blurred background + sharp fitted foreground (no manual zoom)
            format!(
                "[0:v]split=2[bg][fg];\
                 [bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},gblur=sigma=20[blurred];\
                 [fg]scale={w}:{h}:force_original_aspect_ratio=decrease[fitted];\
                 [blurred][fitted]overlay=(W-w)/2:(H-h)/2[combined]",
                w = w, h = h,
            )
        }
        "crop" | "fill" => {
            // Fill canvas, crop edges (no manual zoom)
            format!(
                "[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}[combined]",
                w = w, h = h,
            )
        }
        "black" => {
            // Strict letterbox with black borders (ignore use_blur)
            format!(
                "[0:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black[combined]",
                w = w, h = h,
            )
        }
        "fit" => {
            // Legacy / outro letterbox with black borders (or blurred if use_blur is explicitly true)
            if use_blur {
                format!(
                    "[0:v]split=2[bg][fg];\
                     [bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},gblur=sigma=20[blurred];\
                     [fg]scale={w}:{h}:force_original_aspect_ratio=decrease[fitted];\
                     [blurred][fitted]overlay=(W-w)/2:(H-h)/2[combined]",
                    w = w, h = h,
                )
            } else {
                format!(
                    "[0:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black[combined]",
                    w = w, h = h,
                )
            }
        }
        "manual" => {
            // Apply scale and offset based on "contain" (fit) sizing
            let ox = (offset_x * w as f64).round() as i64;
            let oy = (offset_y * h as f64).round() as i64;
            
            if use_blur {
                format!(
                    "[0:v]split=2[bg][fg];\
                     [bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},gblur=sigma=20[blurred];\
                     [fg]scale='trunc(min({w}/iw,{h}/ih)*iw*{scale}/2)*2':'trunc(min({w}/iw,{h}/ih)*ih*{scale}/2)*2'[zoomed];\
                     [blurred][zoomed]overlay='({w}-overlay_w)/2+{ox}':'({h}-overlay_h)/2+{oy}'[combined]",
                    w = w, h = h, scale = scale,
                    ox = ox, oy = oy,
                )
            } else {
                format!(
                    "color=size={w}x{h}:color=black,fps={fps}[bg];\
                     [0:v]scale='trunc(min({w}/iw,{h}/ih)*iw*{scale}/2)*2':'trunc(min({w}/iw,{h}/ih)*ih*{scale}/2)*2'[zoomed];\
                     [bg][zoomed]overlay='({w}-w)/2+{ox}':'({h}-h)/2+{oy}':shortest=1[combined]",
                    w = w, h = h, fps = fps, scale = scale,
                    ox = ox, oy = oy,
                )
            }
        }
        _ => {
            // stretch
            format!("[0:v]scale={w}:{h}[combined]", w = w, h = h)
        }
    };

    // Add overlay composite
    let has_overlay = !overlay_path.is_empty() && std::path::Path::new(&overlay_path).exists();
    let filter_complex = if has_overlay {
        format!("{resize_filter};[combined][1:v]overlay=0:0[out]")
    } else {
        format!("{resize_filter};[combined]copy[out]")
    };

    let mut args: Vec<String> = vec!["-y".into(), "-i".into(), source_path.clone()];

    if has_overlay {
        args.extend(["-i".into(), overlay_path]);
    }

    eprintln!("[BatchStudio] filter_complex: {}", filter_complex);
    args.extend(["-filter_complex".into(), filter_complex, "-map".into(), "[out]".into()]);

    if render_audio {
        args.extend(["-map".into(), "0:a?".into()]);
    }

    // Codec settings
    if format == "webm" {
        args.extend([
            "-c:v".into(), "libvpx-vp9".into(),
            "-crf".into(), "30".into(),
            "-b:v".into(), bitrate.to_string(),
        ]);
        if render_audio {
            args.extend(["-c:a".into(), "libopus".into(), "-b:a".into(), "128k".into()]);
        }
    } else {
        args.extend([
            "-c:v".into(), "libx264".into(),
            "-preset".into(), "medium".into(),
            "-crf".into(), "18".into(),
            "-b:v".into(), bitrate.to_string(),
            "-maxrate".into(), bitrate.to_string(),
            "-bufsize".into(), (bitrate * 2).to_string(),
            "-pix_fmt".into(), "yuv420p".into(),
        ]);
        if render_audio {
            args.extend(["-c:a".into(), "aac".into(), "-b:a".into(), "192k".into()]);
        }
    }

    args.extend(["-r".into(), fps.to_string(), output_path.clone()]);

    let (mut rx, child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("FFmpeg sidecar not found: {e}"))?
        .args(&args)
        .spawn()
        .map_err(|e| format!("FFmpeg execution failed: {e}"))?;

    // Store child handle so cancel_render can kill it
    {
        let state = app.state::<AppState>();
        let mut guard = state.active_ffmpeg.lock().unwrap();
        *guard = Some(child);
    }

    // Collect stderr for error reporting
    let mut stderr_buf = Vec::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => stderr_buf.extend_from_slice(&line),
            CommandEvent::Terminated(payload) => {
                // Clear the stored handle
                let state = app.state::<AppState>();
                let mut guard = state.active_ffmpeg.lock().unwrap();
                *guard = None;

                if payload.code != Some(0) {
                    return Err(format!(
                        "FFmpeg direct encode failed (exit {:?}):\n{}",
                        payload.code,
                        String::from_utf8_lossy(&stderr_buf)
                    ));
                }
                break;
            }
            _ => {}
        }
    }

    Ok(output_path)
}

#[tauri::command]
async fn concat_videos(
    app: AppHandle,
    input_paths: Vec<String>,
    output_path: String,
) -> Result<String, String> {
    // Validate all input files exist and are valid media
    if input_paths.is_empty() {
        return Err("No input paths provided for concatenation".to_string());
    }
    for p in &input_paths {
        validate_media_file(p)?;
    }

    let list_path =
        std::env::temp_dir().join(format!("concat_{}.txt", &uuid::Uuid::new_v4().to_string()[..8]));

    let content: String = input_paths
        .iter()
        .map(|p| format!("file '{}'", p.replace('\\', "/")))
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(&list_path, &content).map_err(|e| e.to_string())?;

    let (mut rx, child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("FFmpeg sidecar not found: {e}"))?
        .args([
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            &list_path.to_string_lossy(),
            "-c",
            "copy",
            &output_path,
        ])
        .spawn()
        .map_err(|e| format!("FFmpeg concat failed: {e}"))?;

    // Store child handle so cancel_render can kill it
    {
        let state = app.state::<AppState>();
        let mut guard = state.active_ffmpeg.lock().unwrap();
        *guard = Some(child);
    }

    let mut stderr_buf = Vec::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => stderr_buf.extend_from_slice(&line),
            CommandEvent::Terminated(payload) => {
                let state = app.state::<AppState>();
                let mut guard = state.active_ffmpeg.lock().unwrap();
                *guard = None;

                // Clean up the concat list and intermediate files
                let _ = fs::remove_file(&list_path);
                for p in &input_paths {
                    let _ = fs::remove_file(p);
                }

                if payload.code != Some(0) {
                    return Err(format!(
                        "FFmpeg concat failed:\n{}",
                        String::from_utf8_lossy(&stderr_buf)
                    ));
                }
                break;
            }
            _ => {}
        }
    }

    Ok(output_path)
}

#[tauri::command]
fn cleanup_session(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    if let Some(session) = state.sessions.lock().unwrap().remove(&session_id) {
        let _ = fs::remove_dir_all(&session.temp_dir);
    }
    Ok(())
}

#[tauri::command]
fn cancel_render(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.active_ffmpeg.lock().unwrap();
    if let Some(child) = guard.take() {
        let _ = child.kill();
        eprintln!("[BatchStudio] FFmpeg process killed by cancel_render");
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            sessions: Mutex::new(HashMap::new()),
            active_ffmpeg: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            read_config,
            save_config,
            list_compliance_files,
            list_safezone_files,
            get_asset_dir,
            add_asset_file,
            delete_asset_file,
            create_render_session,
            encode_video,
            encode_video_direct,
            concat_videos,
            cleanup_session,
            cancel_render,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Batch Studio");
}

use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::ShellExt;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

struct RenderSession {
    temp_dir: PathBuf,
}

#[derive(Default)]
pub struct AppState {
    sessions: Mutex<HashMap<String, RenderSession>>,
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

/// Try multiple candidate directories — resource dir first, then CWD.
fn find_asset_dir(app: &AppHandle, sub: &str) -> Vec<String> {
    let candidates: Vec<PathBuf> = [
        app.path().resource_dir().ok().map(|p| p.join(sub)),
        std::env::current_dir().ok().map(|p| p.join("public").join(sub)),
        std::env::current_dir().ok().map(|p| p.join("..").join("public").join(sub)),
    ]
    .into_iter()
    .flatten()
    .collect();

    for dir in candidates {
        if dir.exists() {
            return list_images(&dir);
        }
    }
    Vec::new()
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
    let path = ensure_config(&app)?;
    let pretty = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, pretty).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Commands — File Listing
// ---------------------------------------------------------------------------

#[tauri::command]
fn list_compliance_files(app: AppHandle) -> Vec<String> {
    find_asset_dir(&app, "compliance")
}

#[tauri::command]
fn list_safezone_files(app: AppHandle) -> Vec<String> {
    find_asset_dir(&app, "safezones")
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

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("FFmpeg sidecar not found: {e}"))?
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("FFmpeg execution failed: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "FFmpeg encode failed (exit {:?}):\n{}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr)
        ));
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

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("FFmpeg sidecar not found: {e}"))?
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("FFmpeg execution failed: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "FFmpeg direct encode failed (exit {:?}):\n{}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(output_path)
}

#[tauri::command]
async fn concat_videos(
    app: AppHandle,
    input_paths: Vec<String>,
    output_path: String,
) -> Result<String, String> {
    let list_path =
        std::env::temp_dir().join(format!("concat_{}.txt", &uuid::Uuid::new_v4().to_string()[..8]));

    let content: String = input_paths
        .iter()
        .map(|p| format!("file '{}'", p.replace('\\', "/")))
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(&list_path, &content).map_err(|e| e.to_string())?;

    let output = app
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
        .output()
        .await
        .map_err(|e| format!("FFmpeg concat failed: {e}"))?;

    // Clean up the concat list and intermediate files
    let _ = fs::remove_file(&list_path);
    for p in &input_paths {
        let _ = fs::remove_file(p);
    }

    if !output.status.success() {
        return Err(format!(
            "FFmpeg concat failed:\n{}",
            String::from_utf8_lossy(&output.stderr)
        ));
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

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            read_config,
            save_config,
            list_compliance_files,
            list_safezone_files,
            create_render_session,
            encode_video,
            encode_video_direct,
            concat_videos,
            cleanup_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Batch Studio");
}

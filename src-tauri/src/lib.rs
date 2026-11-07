#[cfg(desktop)]
use tauri::Manager;

/// Opens the system print dialog for the window (window.print() does nothing in the Windows webview).
#[tauri::command]
fn print_page(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Desktop only (#168): one copy of the app at a time (a second launch brings the open window to the
    // front, so two windows never write the same data), and the window keeps its size, position and
    // maximised state between runs.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::new().build());

    builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![print_page])
        .setup(|app| {
            #[cfg(desktop)]
            {
                // Auto-update from GitHub releases.
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                // The version in the title: easy to tell which one is running.
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.set_title(&format!("MiniTracker {}", app.package_info().version));
                }
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

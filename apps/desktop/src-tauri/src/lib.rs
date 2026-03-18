use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::webview::PageLoadEvent;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const SPLASH_HTML: &str = r#"<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;align-items:center;justify-content:center;height:100vh;
background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,sans-serif;
flex-direction:column;gap:24px}
.name{font-size:28px;font-weight:600;letter-spacing:2px}
.spinner{width:24px;height:24px;border:2px solid rgba(250,250,250,0.2);
border-top-color:#fafafa;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="name">sugara</div>
<div class="spinner"></div>
</body>
</html>"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let splash_closed = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .register_uri_scheme_protocol("splash", |_req, _responder| {
            tauri::http::Response::builder()
                .header("Content-Type", "text/html; charset=utf-8")
                .body(SPLASH_HTML.as_bytes().to_vec())
                .unwrap()
        })
        .setup(|app| {
            WebviewWindowBuilder::new(
                app,
                "splashscreen",
                WebviewUrl::External("splash://localhost".parse().unwrap()),
            )
            .title("sugara")
            .inner_size(300.0, 400.0)
            .decorations(false)
            .resizable(false)
            .always_on_top(true)
            .center()
            .build()?;

            Ok(())
        })
        .on_page_load({
            let splash_closed = splash_closed.clone();
            move |webview, payload| {
                if webview.label() == "main"
                    && matches!(payload.event(), PageLoadEvent::Finished)
                    && !splash_closed.swap(true, Ordering::SeqCst)
                {
                    let app = webview.app_handle().clone();
                    if let Some(splash) = app.get_webview_window("splashscreen") {
                        let _ = splash.close();
                    }
                    if let Some(main) = app.get_webview_window("main") {
                        let _ = main.show();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use chrono::Datelike;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::webview::PageLoadEvent;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

fn seasonal_colors() -> (&'static str, &'static str) {
    let month = chrono::Local::now().month();
    match month {
        3..=5 => ("#f472b6", "#c084fc"),   // spring: pink -> purple
        6..=8 => ("#22c55e", "#2dd4bf"),   // summer: green -> teal
        9..=11 => ("#f59e0b", "#ef4444"),  // autumn: amber -> red
        _ => ("#60a5fa", "#818cf8"),       // winter: blue -> indigo
    }
}

fn build_splash_html() -> String {
    let (from, to) = seasonal_colors();
    format!(r#"<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{display:flex;align-items:center;justify-content:center;height:100vh;
background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,sans-serif;
flex-direction:column;gap:24px}}
.name{{font-size:28px;font-weight:700;letter-spacing:1px;
background:linear-gradient(to right,{from},{to});
-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
.spinner{{width:24px;height:24px;border:2px solid rgba(250,250,250,0.2);
border-top-color:#fafafa;border-radius:50%;animation:spin .8s linear infinite}}
@keyframes spin{{to{{transform:rotate(360deg)}}}}
</style>
</head>
<body>
<div class="name">sugara</div>
<div class="spinner"></div>
</body>
</html>"#)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let splash_closed = Arc::new(AtomicBool::new(false));
    let splash_html = build_splash_html();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .register_uri_scheme_protocol("splash", move |_req, _responder| {
            tauri::http::Response::builder()
                .header("Content-Type", "text/html; charset=utf-8")
                .body(splash_html.as_bytes().to_vec())
                .unwrap()
        })
        .setup(|app| {
            // Menu
            let about = PredefinedMenuItem::about(
                app,
                Some("sugara について"),
                Some(AboutMetadata {
                    version: Some(app.package_info().version.to_string()),
                    website: Some("https://sugara.vercel.app".to_string()),
                    website_label: Some("sugara.vercel.app".to_string()),
                    ..Default::default()
                }),
            )?;
            let check_update = MenuItemBuilder::with_id("check_update", "アップデートを確認...")
                .build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = PredefinedMenuItem::quit(app, Some("sugara を終了"))?;

            let app_menu = SubmenuBuilder::new(app, "sugara")
                .item(&about)
                .item(&separator)
                .item(&check_update)
                .item(&separator)
                .item(&quit)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "編集")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;

            // Splash screen
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
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "check_update" {
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let msg = match handle
                        .updater()
                        .expect("updater not configured")
                        .check()
                        .await
                    {
                        Ok(Some(update)) => {
                            format!("新しいバージョン {} が利用可能です。", update.version)
                        }
                        Ok(None) => "最新バージョンです。".to_string(),
                        Err(e) => format!("確認に失敗しました: {}", e),
                    };
                    handle
                        .dialog()
                        .message(msg)
                        .title("アップデート")
                        .buttons(MessageDialogButtons::Ok)
                        .show(|_| {});
                });
            }
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

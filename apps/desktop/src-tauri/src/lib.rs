use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use chrono::Datelike;
use tauri::menu::{
    AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::webview::PageLoadEvent;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

const BASE_URL: &str = "https://sugara.vercel.app";

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

fn eval_main_webview(app: &tauri::AppHandle, js: &str) {
    if let Some(win) = app.get_webview_window("main") {
        if let Err(e) = win.eval(js) {
            eprintln!("[menu] eval failed: {e}");
        }
    }
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
                .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
        })
        .setup(|app| {
            // --- App menu ---
            let about = PredefinedMenuItem::about(
                app,
                Some("sugara について"),
                Some(AboutMetadata {
                    version: Some(app.package_info().version.to_string()),
                    website: Some(BASE_URL.to_string()),
                    website_label: Some("sugara.vercel.app".to_string()),
                    ..Default::default()
                }),
            )?;
            let check_update = MenuItemBuilder::with_id("check_update", "アップデートを確認...")
                .build(app)?;
            let quit = PredefinedMenuItem::quit(app, Some("sugara を終了"))?;

            let app_menu = SubmenuBuilder::new(app, "sugara")
                .item(&about)
                .separator()
                .item(&check_update)
                .separator()
                .item(&quit)
                .build()?;

            // --- Edit menu ---
            let edit_menu = SubmenuBuilder::new(app, "編集")
                .item(&PredefinedMenuItem::undo(app, Some("取り消す"))?)
                .item(&PredefinedMenuItem::redo(app, Some("やり直す"))?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, Some("カット"))?)
                .item(&PredefinedMenuItem::copy(app, Some("コピー"))?)
                .item(&PredefinedMenuItem::paste(app, Some("ペースト"))?)
                .item(&PredefinedMenuItem::select_all(app, Some("すべてを選択"))?)
                .build()?;

            // --- View menu ---
            let reload = MenuItemBuilder::with_id("reload", "リロード")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let zoom_in = MenuItemBuilder::with_id("zoom_in", "拡大")
                .accelerator("CmdOrCtrl+=")
                .build(app)?;
            let zoom_out = MenuItemBuilder::with_id("zoom_out", "縮小")
                .accelerator("CmdOrCtrl+-")
                .build(app)?;
            let zoom_reset = MenuItemBuilder::with_id("zoom_reset", "実際のサイズ")
                .accelerator("CmdOrCtrl+0")
                .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "表示")
                .item(&reload)
                .separator()
                .item(&zoom_in)
                .item(&zoom_out)
                .item(&zoom_reset)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(app, Some("フルスクリーン"))?)
                .build()?;

            // --- Navigate menu ---
            let go_back = MenuItemBuilder::with_id("go_back", "戻る")
                .accelerator("CmdOrCtrl+[")
                .build(app)?;
            let go_forward = MenuItemBuilder::with_id("go_forward", "進む")
                .accelerator("CmdOrCtrl+]")
                .build(app)?;

            let navigate_menu = SubmenuBuilder::new(app, "移動")
                .item(&go_back)
                .item(&go_forward)
                .build()?;

            // --- Window menu ---
            let window_menu = SubmenuBuilder::new(app, "ウィンドウ")
                .item(&PredefinedMenuItem::minimize(app, Some("しまう"))?)
                .item(&PredefinedMenuItem::maximize(app, Some("拡大/縮小"))?)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, Some("ウィンドウを閉じる"))?)
                .build()?;

            // --- Help menu ---
            let help_faq = MenuItemBuilder::with_id("help_faq", "よくある質問")
                .build(app)?;
            let help_news = MenuItemBuilder::with_id("help_news", "お知らせ")
                .build(app)?;
            let help_terms = MenuItemBuilder::with_id("help_terms", "利用規約")
                .build(app)?;

            let help_menu = SubmenuBuilder::new(app, "ヘルプ")
                .item(&help_faq)
                .item(&help_news)
                .separator()
                .item(&help_terms)
                .build()?;

            // --- Build menu bar ---
            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&navigate_menu)
                .item(&window_menu)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            // Splash screen
            WebviewWindowBuilder::new(
                app,
                "splashscreen",
                WebviewUrl::External("splash://localhost".parse::<tauri::Url>().map_err(|e| {
                    Box::new(e) as Box<dyn std::error::Error>
                })?),
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
            let id = event.id().as_ref();
            match id {
                "check_update" => {
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let updater = match handle.updater() {
                            Ok(u) => u,
                            Err(e) => {
                                handle
                                    .dialog()
                                    .message(format!("アップデート機能の初期化に失敗しました: {e}"))
                                    .title("アップデート")
                                    .buttons(MessageDialogButtons::Ok)
                                    .show(|_| {});
                                return;
                            }
                        };
                        let msg = match updater.check().await {
                            Ok(Some(update)) => {
                                format!("新しいバージョン {} が利用可能です。", update.version)
                            }
                            Ok(None) => "最新バージョンです。".to_string(),
                            Err(e) => format!("確認に失敗しました: {e}"),
                        };
                        handle
                            .dialog()
                            .message(msg)
                            .title("アップデート")
                            .buttons(MessageDialogButtons::Ok)
                            .show(|_| {});
                    });
                }
                "reload" => eval_main_webview(app, "location.reload()"),
                "zoom_in" => eval_main_webview(
                    app,
                    "document.body.style.zoom = String(parseFloat(document.body.style.zoom || '1') + 0.1)",
                ),
                "zoom_out" => eval_main_webview(
                    app,
                    "document.body.style.zoom = String(Math.max(0.5, parseFloat(document.body.style.zoom || '1') - 0.1))",
                ),
                "zoom_reset" => eval_main_webview(app, "document.body.style.zoom = '1'"),
                "go_back" => eval_main_webview(app, "history.back()"),
                "go_forward" => eval_main_webview(app, "history.forward()"),
                "help_faq" => {
                    let _ = app.opener().open_url(&format!("{BASE_URL}/faq"), None::<&str>);
                }
                "help_news" => {
                    let _ = app.opener().open_url(&format!("{BASE_URL}/news"), None::<&str>);
                }
                "help_terms" => {
                    let _ = app.opener().open_url(&format!("{BASE_URL}/terms"), None::<&str>);
                }
                _ => {}
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

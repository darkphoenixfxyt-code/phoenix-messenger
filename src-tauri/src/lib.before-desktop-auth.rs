#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri::plugin::Builder::<tauri::Wry>::new("phoenix-navigation-guard")
        .on_navigation(|_webview, url| {
          let host = url.host_str().unwrap_or_default();
          let allowed = url.scheme() == "tauri"
            || (cfg!(debug_assertions) && matches!(host, "localhost" | "127.0.0.1"))
            || matches!(
              host,
              "phoenix-messenger.netlify.app"
                | "phoenix-messenger-c2f5f.firebaseapp.com"
                | "accounts.google.com"
            );
          if !allowed && matches!(url.scheme(), "http" | "https") {
            let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
          }
          allowed
        })
        .build(),
    )
    .setup(|app| {
      use std::{net::TcpStream, time::Duration};
      use tauri::Manager;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
          .build(),
        )?;
      }
      let online = "1.1.1.1:53"
        .parse()
        .ok()
        .and_then(|address| TcpStream::connect_timeout(&address, Duration::from_secs(2)).ok())
        .is_some();
      if !online {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.navigate(tauri::Url::parse("tauri://localhost/offline.html")?);
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

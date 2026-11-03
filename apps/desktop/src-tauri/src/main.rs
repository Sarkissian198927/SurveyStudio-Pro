#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod storage;
mod online;
use tauri::Manager;
#[tauri::command]
async fn sync_push(server: String, token: String, payload: serde_json::Value) -> Result<serde_json::Value, String> {
    let url = reqwest::Url::parse(&server).map_err(|_| "Ungültige Serveradresse")?;
    if url.scheme() != "https" { return Err("Synchronisation verlangt HTTPS".into()); }
    if !url.username().is_empty() || url.password().is_some() { return Err("Zugangsdaten gehören nicht in die URL".into()); }
    let endpoint = url.join("/api/v1/sync/push").map_err(|_| "Ungültige Serveradresse")?;
    let client = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(30)).build().map_err(|_| "HTTP-Client nicht verfügbar")?;
    let response = client.post(endpoint).bearer_auth(token).json(&payload).send().await.map_err(|_| "Server nicht erreichbar oder TLS-Prüfung fehlgeschlagen")?;
    if !response.status().is_success() { return Err(format!("Synchronisation abgelehnt: HTTP {}. Lokale Warteschlange bleibt erhalten.", response.status().as_u16())); }
    response.json().await.map_err(|_| "Ungültige Serverantwort".into())
}
fn main() {
    tauri::Builder::default()
        .setup(|app|{
            let directory=app.path().app_config_dir()?;std::fs::create_dir_all(&directory)?;
            #[cfg(unix)]{use std::os::unix::fs::PermissionsExt;std::fs::set_permissions(&directory,std::fs::Permissions::from_mode(0o700))?;}
            app.manage(storage::initialize(&directory.join("surveystudio.db"))?);Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![sync_push,online::check_online_server,online::open_online_portal,storage::sql_execute,storage::sql_select,storage::sql_batch])
        .run(tauri::generate_context!())
        .expect("SurveyStudio konnte nicht gestartet werden");
}

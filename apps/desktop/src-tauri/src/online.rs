use serde_json::{Value,json};
use tauri_plugin_opener::OpenerExt;

fn server_origin(value:&str)->Result<reqwest::Url,String>{
    let mut url=reqwest::Url::parse(value.trim()).map_err(|_|"Bitte eine gültige HTTPS-Serveradresse eingeben.")?;
    if url.scheme()!="https"||url.host_str().is_none(){return Err("Der Online-Zugang benötigt eine HTTPS-Adresse.".into());}
    if !url.username().is_empty()||url.password().is_some()||url.query().is_some()||url.fragment().is_some(){return Err("Bitte die Serveradresse ohne Zugangsdaten, Abfrageparameter oder Fragment eingeben.".into());}
    url.set_path("/");Ok(url)
}
fn client()->Result<reqwest::Client,String>{reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(15)).build().map_err(|_|"HTTPS-Verbindung konnte nicht vorbereitet werden.".into())}
async fn bounded_json(client:&reqwest::Client,url:reqwest::Url)->Result<Value,String>{
    let mut response=client.get(url).send().await.map_err(|_|"Server nicht erreichbar oder TLS-Zertifikat nicht vertrauenswürdig. Bitte Adresse und Internetverbindung prüfen.")?;
    if !response.status().is_success(){return Err(format!("Der Server antwortet mit HTTP {}. Bitte die Basisadresse der Webversion prüfen.",response.status().as_u16()));}
    let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|_|"Serverantwort konnte nicht gelesen werden.")?{if bytes.len()+chunk.len()>256_000{return Err("Serverantwort ist unerwartet groß.".into());}bytes.extend_from_slice(&chunk);}
    serde_json::from_slice(&bytes).map_err(|_|"Die Adresse liefert keine gültige SurveyStudio-API-Antwort.".into())
}
async fn check(server:&str)->Result<Value,String>{
    let origin=server_origin(server)?;let client=client()?;
    let health=bounded_json(&client,origin.join("api/v1/health").map_err(|_|"Ungültiger API-Pfad")?).await?;
    if health["status"]!="ok"{return Err("Die Webversion meldet einen Dienst- oder Datenbankfehler.".into());}
    if health["service"]!="surveystudio-pro"{
        let api=bounded_json(&client,origin.join("api/v1/openapi.json").map_err(|_|"Ungültiger API-Pfad")?).await?;
        if !api["info"]["title"].as_str().is_some_and(|title|title.starts_with("SurveyStudio Pro")){return Err("Unter dieser Adresse wurde keine SurveyStudio-Webversion erkannt.".into());}
    }
    let base=origin.origin().ascii_serialization();Ok(json!({"origin":base,"loginUrl":format!("{}/login",base),"service":"surveystudio-pro","version":health["version"]}))
}
#[tauri::command]
pub async fn check_online_server(server:String)->Result<Value,String>{check(&server).await}
#[tauri::command]
pub async fn open_online_portal(app:tauri::AppHandle,server:String)->Result<(),String>{
    let result=check(&server).await?;let url=result["loginUrl"].as_str().ok_or("Online-Anmeldung nicht verfügbar")?;
    app.opener().open_url(url,None::<&str>).map_err(|_|"Der Standardbrowser konnte nicht geöffnet werden. Bitte die Serveradresse im Browser öffnen.".into())
}
#[cfg(test)]
mod tests{
    use super::*;
    #[test]
    fn accepts_https_and_normalizes_portal_paths(){assert_eq!(server_origin("https://example.test/app").unwrap().as_str(),"https://example.test/");assert_eq!(server_origin("https://localhost:7443").unwrap().as_str(),"https://localhost:7443/");}
    #[test]
    fn rejects_insecure_or_credential_bearing_urls(){for value in ["http://example.test","javascript:alert(1)","file:///tmp/test","https://user:secret@example.test","https://example.test?token=secret","https://example.test/#token"]{assert!(server_origin(value).is_err(),"{}",value);}}
}

use rusqlite::{params_from_iter,types::{Value,ValueRef},Connection};
use serde_json::{Map,Value as Json};
use std::{path::Path,sync::Mutex};
use tauri::State;
use zeroize::{Zeroizing,Zeroize};
use fs2::FileExt;
pub struct ProtectedDatabase(pub Mutex<Connection>);

pub fn open_database(path:&Path,password:&str)->Result<Connection,Box<dyn std::error::Error>> {
    let connection=Connection::open(path)?;
    connection.pragma_update(None,"key",password)?;
    let cipher:String=connection.query_row("PRAGMA cipher_version",[],|r|r.get(0))?;
    if cipher.is_empty(){return Err("SQLCipher ist nicht verfügbar".into());}
    connection.query_row("SELECT count(*) FROM sqlite_master",[],|r|r.get::<_,i64>(0))?;
    connection.pragma_update(None,"cipher_memory_security","ON")?;
    connection.pragma_update(None,"foreign_keys","ON")?;
    connection.pragma_update(None,"journal_mode","WAL")?;
    connection.pragma_update(None,"temp_store","MEMORY")?;
    Ok(connection)
}

fn initialize_lock(path:&Path)->Result<std::fs::File,Box<dyn std::error::Error>>{let file=std::fs::OpenOptions::new().create(true).truncate(false).read(true).write(true).open(path.with_extension("init.lock"))?;file.try_lock_exclusive().map_err(|_|"Lokaler Speicher wird bereits initialisiert; bitte andere Instanz schließen.")?;Ok(file)}

pub fn initialize(path:&Path)->Result<ProtectedDatabase,Box<dyn std::error::Error>> {
    let _initialization_lock=initialize_lock(path)?;
    let credential=keyring::Entry::new("de.surveystudio.pro","database-key-v1")?;
    let password=Zeroizing::new(match credential.get_password(){
        Ok(value)=>value,
        Err(keyring::Error::NoEntry)=>{
            if path.exists(){return Err("Datenbank vorhanden, aber Schlüssel fehlt. Schlüssel wiederherstellen; es wird kein Ersatz erzeugt.".into());}
            let mut bytes=[0u8;32];getrandom::fill(&mut bytes).map_err(|_|"Zufallsquelle nicht verfügbar")?;
            let value=hex::encode(bytes);bytes.zeroize();credential.set_password(&value)?;value
        },
        Err(_)=>return Err("Betriebssystem-Schlüsselbund nicht verfügbar. Kein unverschlüsselter Fallback.".into()),
    });
    Ok(ProtectedDatabase(Mutex::new(open_database(path,&password)?)))
}
fn parameters(values:Vec<Json>)->Result<Vec<Value>,String>{values.into_iter().map(|v|match v{Json::Null=>Ok(Value::Null),Json::Bool(b)=>Ok(Value::Integer(if b{1}else{0})),Json::Number(n)=>if let Some(i)=n.as_i64(){Ok(Value::Integer(i))}else{n.as_f64().map(Value::Real).ok_or("Ungültige Zahl".into())},Json::String(s)=>Ok(Value::Text(s)),_=>Err("SQL-Parameter müssen skalare Werte sein".into())}).collect()}
#[tauri::command]
pub fn sql_execute(sql:String,values:Vec<Json>,db:State<'_,ProtectedDatabase>)->Result<Json,String>{
    let prefix=sql.trim_start().split_whitespace().next().unwrap_or("").to_uppercase();
    if !["CREATE","INSERT","UPDATE","DELETE"].contains(&prefix.as_str()){return Err("SQL-Operation nicht freigegeben".into());}
    let connection=db.0.lock().map_err(|_|"Datenbanksperre nicht verfügbar")?;
    let values=parameters(values)?;
    let changed=connection.execute(&sql,params_from_iter(values.iter())).map_err(|_|"SQLite-Operation abgelehnt: Konflikt, ungültiger Zustand oder Speicherfehler")?;
    Ok(serde_json::json!({"rowsAffected":changed}))
}
#[tauri::command]
pub fn sql_select(sql:String,values:Vec<Json>,db:State<'_,ProtectedDatabase>)->Result<Json,String>{
    if !sql.trim_start().to_uppercase().starts_with("SELECT "){return Err("Nur lesende Abfragen erlaubt".into());}
    let connection=db.0.lock().map_err(|_|"Datenbanksperre nicht verfügbar")?;
    let values=parameters(values)?;let mut statement=connection.prepare(&sql).map_err(|_|"Abfrage nicht verfügbar")?;
    let columns=statement.column_names().iter().map(|s|s.to_string()).collect::<Vec<_>>();
    let rows=statement.query_map(params_from_iter(values.iter()),|row|{
        let mut object=Map::new();for (i,name) in columns.iter().enumerate(){let value=match row.get_ref(i)?{ValueRef::Null=>Json::Null,ValueRef::Integer(n)=>Json::from(n),ValueRef::Real(n)=>Json::from(n),ValueRef::Text(t)=>Json::String(String::from_utf8_lossy(t).to_string()),ValueRef::Blob(b)=>Json::Array(b.iter().map(|n|Json::from(*n)).collect())};object.insert(name.clone(),value);}Ok(Json::Object(object))
    }).map_err(|_|"Abfrage fehlgeschlagen")?;
    Ok(Json::Array(rows.collect::<Result<Vec<_>,_>>().map_err(|_|"Ungültiger Datenbankwert")?))
}
#[derive(serde::Deserialize)]
#[serde(rename_all="camelCase")]
pub struct SqlOperation { sql:String, #[serde(default)] values:Vec<Json>, expected_changes:Option<usize> }
fn execute_batch(connection:&mut Connection,operations:Vec<SqlOperation>)->Result<(),String>{
    if operations.is_empty()||operations.len()>1000{return Err("Ungültige Anzahl Datenbankoperationen".into());}
    let transaction=connection.transaction().map_err(|_|"Transaktion nicht verfügbar")?;
    for operation in operations {
        let prefix=operation.sql.trim_start().split_whitespace().next().unwrap_or("").to_uppercase();
        if !["CREATE","INSERT","UPDATE","DELETE"].contains(&prefix.as_str()){return Err("SQL-Operation nicht freigegeben".into());}
        let values=parameters(operation.values)?;
        let changed=transaction.execute(&operation.sql,params_from_iter(values.iter())).map_err(|_|"SQLite-Transaktion abgelehnt; Änderungen zurückgerollt")?;
        if operation.expected_changes.is_some_and(|expected|expected!=changed){return Err("409: Lokaler Versionskonflikt; Änderungen zurückgerollt".into());}
    }
    transaction.commit().map_err(|_|"Transaktion konnte nicht gespeichert werden".into())
}
#[tauri::command]
pub fn sql_batch(operations:Vec<SqlOperation>,db:State<'_,ProtectedDatabase>)->Result<(),String>{
    let mut connection=db.0.lock().map_err(|_|"Datenbanksperre nicht verfügbar")?;
    execute_batch(&mut connection,operations)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn batch_rolls_back_on_conflict(){
        let mut db=Connection::open_in_memory().unwrap();db.execute("CREATE TABLE sample(value TEXT)",[]).unwrap();
        let operation=|sql:&str,expected|SqlOperation{sql:sql.into(),values:vec![],expected_changes:expected};
        assert!(execute_batch(&mut db,vec![operation("INSERT INTO sample VALUES('rollback')",Some(1)),operation("UPDATE sample SET value='changed' WHERE value='missing'",Some(1))]).is_err());
        assert_eq!(db.query_row("SELECT count(*) FROM sample",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        execute_batch(&mut db,vec![operation("INSERT INTO sample VALUES('committed')",Some(1))]).unwrap();
        assert_eq!(db.query_row("SELECT value FROM sample",[],|r|r.get::<_,String>(0)).unwrap(),"committed");
    }
    #[cfg(target_os="windows")]
    #[test]
    fn windows_keyring_roundtrip(){
        let account=format!("installer-test-{}",hex::encode({let mut n=[0u8;16];getrandom::fill(&mut n).unwrap();n}));
        let entry=keyring::Entry::new("de.surveystudio.pro.test",&account).unwrap();entry.set_password("synthetic-installer-test-secret").unwrap();assert_eq!(entry.get_password().unwrap(),"synthetic-installer-test-secret");entry.delete_credential().unwrap();assert!(matches!(entry.get_password(),Err(keyring::Error::NoEntry)));
    }
    #[test]
    fn initialization_is_exclusive(){let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db");let lock=initialize_lock(&path).unwrap();assert!(initialize_lock(&path).is_err());drop(lock);assert!(initialize_lock(&path).is_ok());}
    #[test]
    fn encrypted_file_reopens_and_rejects_wrong_key(){
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("encrypted.db");
        {let db=open_database(&path,"synthetic-test-key-with-32-characters").unwrap();db.execute("CREATE TABLE protected(value TEXT)",[]).unwrap();db.execute("INSERT INTO protected VALUES(?1)",["Geheime Testdaten Grüße"]).unwrap();}
        let bytes=std::fs::read(&path).unwrap();assert!(!bytes.starts_with(b"SQLite format 3"));assert!(!bytes.windows(b"Geheime Testdaten ".len()).any(|b|b==b"Geheime Testdaten "));
        assert!(open_database(&path,"wrong-test-key").is_err());let db=open_database(&path,"synthetic-test-key-with-32-characters").unwrap();let value:String=db.query_row("SELECT value FROM protected",[],|r|r.get(0)).unwrap();assert_eq!(value,"Geheime Testdaten Grüße");
    }
}

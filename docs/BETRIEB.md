# Betrieb und Wiederherstellung

## Lokale Entwicklung

Im vorhandenen Checkout arbeiten; kein zusätzliches Git-Worktree nötig. `pnpm install --frozen-lockfile`, `node scripts/configure-local.cjs`, `pnpm build`, `docker compose up -d --wait`, `pnpm db:migrate`. Anschließend API und Web in getrennten Prozessen starten. Laufende Prozesse überleben eine neue Cloud-Maschine nicht zuverlässig; Installation und Daten sind davon getrennt zu betrachten.

## App-Container

`Dockerfile` baut Web/API/Pakete und startet als Benutzer `node`. `.dockerignore` schließt Geheimnisdateien, Git-Metadaten und lokale Build-/Dependency-Caches aus. Die Proxy-CA wird ausschließlich in netzwerkfähigen Build-Schritten als Secret gemountet; TLS-Prüfung wird nicht abgeschaltet.

In dieser verwalteten Umgebung:

```sh
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t surveystudio-pro:local .
```

Außerhalb der Plattform ist das Secret optional, wenn die normale CA-Vertrauenskette genügt. Für Produktion `docker-compose.prod.yml` mit sicher bereitgestellten Umgebungswerten und externem HTTPS-Reverse-Proxy verwenden. Produktivwerte und Domains wurden hier nicht erfunden oder veröffentlicht.

Die Datenbankverbindung unterstützt `DATABASE_URL` oder die standardmäßigen `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`. Die getrennten Variablen vermeiden Probleme mit URL-Sonderzeichen in Kennwörtern. Zugriff auf Datenbank und API ist im Beispiel von außen auf Host-Loopback beschränkt bzw. nur im internen Compose-Netz erreichbar.

## Schlüssel und Dateispeicher

- `JWT_SECRET`: Sitzungen. Nicht mit einem Beispielwert betreiben.
- `DATA_ENCRYPTION_KEY`: dauerhafter Datenschlüssel für verschlüsselte Identitäten/Mailpayloads; in Produktion Pflicht.
- In bestehenden Entwicklungsinstallationen kann noch der frühere JWT-basierte Schlüsselpfad aktiv sein. Eine Schlüsseländerung ohne Re-Verschlüsselung macht alte Payloads unlesbar. Kontrollierte Migration und getrennte Schlüsselsicherung sind Voraussetzung für Rotation.
- `ASSET_DIR`: Rasterbildspeicher; im Container `/app/storage/assets`, mit dauerhaftem Volume.
- `EXPORT_DIR`: kurzlebige Exportdateien; Jobs laufen nach einer Stunde ab. Datenschutzlöschungen sperren vorhandene Jobs und entfernen ihre Dateien. Wiederherstellung muss auch diese Randdaten/Schlüssel berücksichtigen.

Bilder werden vor Speicherung vollständig decodiert, auf Pixel-/Dateigröße begrenzt und ohne Metadaten als WebP neu kodiert. Diese Pipeline ist kein allgemeiner Malware-Scanner für beliebige Dokumentformate. Antwort-Dateianhänge werden als begrenzte Datenwerte gespeichert und nicht als aktive Webseiten ausgeliefert; eine vollständige AV-/Dokumenten-Sanitization-Pipeline steht aus.

## Backups für die lokale Docker-Datenbank

`BACKUP_PASSPHRASE` sicher außerhalb von Chat/Repository bereitstellen, mindestens 20 Zeichen. Dann:

```sh
node scripts/backup.cjs create /sicherer/pfad/survey-backup.enc
node scripts/backup.cjs restore /sicherer/pfad/survey-backup.enc restore_probe
```

Der Helper ist ausdrücklich auf die lokale Compose-Datenbank `surveystudio`/`survey` zugeschnitten. Er verwendet den lokalen Docker-Socket, keinen möglicherweise anders ausgewählten Remote-Kontext. Wiederherstellung ist nur in eine neu angelegte Datenbank `restore_...` möglich und überschreibt die laufende Datenbank nicht. AES-GCM wird vor dem ersten Datenbank-Schreibzugriff vollständig geprüft. Der vorhandene Helper lädt beim Restore das entschlüsselte Archiv in den Speicher; dies ist noch keine speicherschonende Wiederherstellung großer Produktionsdatenbanken.

Getestet: neue Wiederherstellungsdatenbank, 50 wiederhergestellte Antworten samt Unicode, Versionshash und kritischen Referenzen, erneute Migration, wirksame Fremdschlüssel und Manipulationserkennung vor Datenbankanlage. Noch nicht nachgewiesen: kompletter Produktionsdatenbestand einschließlich Asset-Volume, Schlüssel, Backups anderer Umgebungen, RPO 24 h/RTO 4 h, Quartalsrhythmus und Disaster-Recovery-Runbook. Diese Punkte sind keine bestandene Produktionsabnahme.

## Löschfristen und Audit

Der stündliche Wartungslauf entfernt Antwortsitzungen nach der im jeweiligen veröffentlichten Snapshot ausdrücklich gesetzten Frist. Die manuelle Berechtigungsprüfung erlaubt einen ownergeschützten Lauf pro Umfrage. Alte Versionen ohne konfigurierte Frist werden nicht automatisch gelöscht. Personenbezogene Löschung über die Teilnehmerverwaltung entfernt zugeordnete Antworten und sperrt Ergebnis-/Exportartefakte. Das Lösen einer Zuordnung ist ein eigener Vorgang und garantiert nicht, dass Freitextinhalte anonym sind.

Weitere Regeln für Einladungsliste, nicht zugeordnete Mail-/Jobdaten, unveränderliche Fragebogensnapshots, nicht mehr benötigte Assets und Backup-Retention müssen für eine vollständige produktive Datenschutzabnahme ergänzt werden. Die Datenbank verhindert reguläre Änderungen/Löschungen an veröffentlichten Snapshots und Auditereignissen; privilegierte Datenbankadministration und Betriebsrollen erfordern zusätzliche Kontrolle.

## Noch ausstehende externe Voraussetzungen

Echter SMTP-/Providerzugang und autorisierter Absender; eine HTTPS-Deployment-Domain/TLS-Konfiguration; Windows-Build-/GUI-Abnahme und Signierung; tatsächliche Schlüsselbundanbieter-Abnahme; reale Datenschutz-/Betriebsentscheidungen. Geheimniswerte über geschützte Umgebungseinstellungen eintragen. Hier wurden weder externe E-Mails versandt noch eine Website oder ein Release veröffentlicht.

## Native Schlüssel

Die Tauri-Anwendung verschlüsselt ihre lokale DB mit SQLCipher. Der zufällige 256-Bit-Schlüssel wird im OS-Schlüsselbund abgelegt; fehlender Anbieter oder verlorener Schlüssel führt zum Abbruch. Keine automatische Schlüsselersetzung für eine bereits vorhandene Datenbank. Datenbank und sichere Schlüssel-/Schlüsselbundsicherung gehören zusammen. Ein Dateilock verhindert parallele Initialisierung mit unterschiedlichen Schlüsseln. Native Dateitests ersetzen keine Windows-/Schlüsselbund-/Disaster-Recovery-Abnahme.

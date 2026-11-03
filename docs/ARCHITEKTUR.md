# Architektur

React/TypeScript/Vite im Browser, NestJS unter `/api/v1`, PostgreSQL 16 für Webdaten, Tauri 2 mit SQLCipher für lokale Daten. pnpm 10.11.0 verwaltet zwölf Workspaces. Paket-, API- und Webbuilds verwenden TypeScript mit strikter Prüfung. Der geerbte Shared-Kern bleibt teilweise CommonJS; dies ist keine vollständig migrierte TypeScript-Domänenarchitektur.

## Gemeinsame Logik

`shared` enthält Schema, die 19 Fragetypen, Antwortvalidierung, Seiten-/Bedingungslogik, kanonische JSON-Darstellung und Hintergrundberechnung. `schema`, `logic`, `contracts` und `analytics` bieten typisierte Adapter bzw. Rechtematrix. `renderer` wird für Designer-Vorschau und Teilnahme verwendet; es rendert Formulare und sichere reduzierte Textformatierung ohne beliebiges HTML. `desktop-store` kapselt lokale Persistenz über einen SqlDriver. `ui` enthält gemeinsame Oberflächenelemente.

Hintergrundbild, Verlauf und Muster werden über dieselbe Funktion berechnet. Remote-Bildquellen sind auf die eigene Asset-Route begrenzt, Inline-Bilder auf begrenzte Rasterdaten. Die API decodiert hochgeladene Logo-/Hintergrunddateien und kodiert sie ohne Metadaten neu. Inline-Bildoptionen und Dateiantworten erhalten Typ-/Größenprüfungen, aber noch keine vollständige Dokument-Sanitization.

## Identität und Rechte

Registrierung legt Benutzer, Arbeitsbereich und erstes Projekt atomar an. bcrypt verwendet Kostenfaktor 12; die 72-Byte-Grenze wird vor Hashing geprüft. HttpOnly-/SameSite-Lax-Cookies enthalten signierte Sitzungsdaten; die API prüft zusätzlich bei jeder Anfrage Benutzer, Ablauf und widerrufbaren Sessiondatensatz. Schreibzugriffe erfordern CSRF. Produktionsstart verlangt sichere Cookies und einen gesonderten dauerhaften Datenschlüssel.

Reset und Verifikation verwenden gehashte, einmalige, kurzlebige Token. Passwortänderung widerruft bestehende Sitzungen. Personenidentitäten und Mailpayloads werden per AES-GCM gespeichert. Die SMTP-Queue nutzt TLS, einen festen Betreiberabsender, Retry/Status und eine stabile Message-ID. Das Entwicklungspostfach ist in Produktion gesperrt. Tatsächliche Zustellung wurde mangels SMTP-Konfiguration nicht geprüft.

Mandanten-Fremdschlüssel schützen Beziehungen. Projektrollen werden bei jeder Anfrage gelesen: Owner verwalten; Editor bearbeiten; Viewer/Gast lesen eingeschränkte Aggregate; Analyst liest Auswertungen ohne Rohdatenexport. Ownerrechte sind für Teilnehmer, Rohdatenexport, Ergebnisfreigabe und Datenschutzlöschung erforderlich. Letzter-Owner-Änderungen werden serialisiert. Individuelle Berechtigungen und tatsächliche Betriebsrollen sind noch nicht vollständig ausgebaut.

## Entwürfe, Versionen und Antworten

Entwurfsspeicherung verwendet erwartete Revisionen als atomare Compare-and-swap-Prüfung. Historie und Kommentare sind persistent; Restore erzeugt eine neue Revision. Nach 409 stoppt automatisches Speichern bis zur Konfliktbehandlung. Asynchrone Lade-/Speicherergebnisse sind gegen inzwischen gewechselte Umfragen abgeschirmt.

Veröffentlichung liest den Entwurf unter Sperre, validiert und erzeugt einen Snapshot mit Hash und Versionsnummer. Datenbanktrigger verhindern reguläre Änderung/Löschung publizierter Snapshots und Auditereignisse. Die API sperrt die Publikation während der Abgabe und prüft Status, Zeitfenster und Limit. Gemeinsame Logik entfernt versteckte/übersprungene Werte. Antwort und Einzelwerte werden vor dem ACK in einer Transaktion gespeichert. Idempotenz vergleicht bereinigte kanonische Werte und verhindert Duplikate unabhängig von JSON-Key-Reihenfolge.

Anonyme Antworten haben keine technische Teilnehmerzuordnung; die DB verhindert eine solche Verknüpfung. Persönliche Modi verlangen einen passenden Einladungstoken und halten Identität/Antwort getrennt. Freitext kann dennoch Personenbezüge enthalten. Der Datenschutzhinweis und eine gegebenenfalls erforderliche Zustimmung werden versionsgebunden gespeichert; produktive Freigabe verlangt Verantwortlichen, Kontakt, Zweck, Rechtsgrundlage und Hinweisversion.

## Auswertung, Exporte und Datenschutz

PostgreSQL berechnet Aggregate innerhalb eines konsistenten Lesesnapshots; Rohantworten werden nicht vollständig in den Browser geladen. Öffentliche Freigaben enthalten eingefrorene Aggregate mit Mindestgruppen und Unterdrückung ganzer Fragen bei kleinen Zellen. Sie erlauben keine öffentlichen Rohdaten-/Zeitfilter. Dies ist kein vollständiger Beweis gegen statistische Reidentifizierung oder Kombination mehrerer Freigaben.

CSV/XLSX/PDF laufen als berechtigte, ablaufende Jobs. CSV/XLSX lesen jeweils 500 Sitzungen; Dateien sind an die angeforderte Version gebunden. CSV schützt Formelpräfixe. PDF bettet lizenzierte Unicode-Schriften ein. Für ExcelJS wird ein dokumentierter Einzeilenpatch gepflegt, der `StreamBuf.pipe()` vertragsgemäß das Ziel zurückgeben lässt; damit bleibt die aktualisierte Archivbibliothek nutzbar. XLSX-Import prüft vor XML-Verarbeitung zentrale und lokale ZIP-Einträge einschließlich tatsächlicher Dekompressionsgrenzen.

Personenexport/-berichtigung/-löschung, Entkopplung, bestätigtes Löschen aller Antworten und stündliche Antwort-Retention sind implementiert. Datenschutzlöschung invalidiert Freigaben und Exportdateien. Vollständige Identitäts-/Mail-/Asset-/Backup-Retention bleibt offen.

## Native Speicherung und Synchronisation

Tauri verwendet eigene gebundene SQL-Kommandos mit rusqlite/SQLCipher. Ein zufälliger 256-Bit-Schlüssel liegt im Betriebssystem-Schlüsselbund; bei fehlendem Anbieter/Schlüssel wird nicht auf Klartext zurückgefallen. Ein Dateilock schützt die initiale Schlüsselerzeugung. Schlüsselmaterial wird nach Benutzung überschrieben. Lokale Dateitests beweisen SQLCipher-Verschlüsselung und Wiederöffnung mit richtigem, nicht mit falschem Schlüssel. Windows-GUI und tatsächliche Schlüsselbundintegration sind damit noch nicht geprüft.

Der lokale Store persistiert Entwürfe, Versionen, Publikationen, Kommentare, Antworten und Outbox. HTTPS-Push verwendet begrenzte Batches und widerrufbare Gerätezugänge. Der Server prüft Zielprojekt, Operation-ID, Payload-Hash, Revision und Rechte; Queueeinträge werden erst nach ACK bestätigt. Importierte Webpublikationen bleiben zunächst pausiert. Pull, automatische Planung, Lösch-Tombstones und vollständige Mehrgerätekonflikte fehlen.

## Betrieb und Migrationen

Zehn additive Migrationen werden mit Advisory-Lock, SHA256-Prüfung und Transaktionen ausgeführt. 001/002 bleiben unverändert. Fehler enthalten stabile Codes und serverseitige Request-ID, keine internen Stacktraces. Health prüft die Datenbank. OpenAPI ist formal validiert; ergänzte Routen sind noch nicht vollständig mit typisierten DTO-Schemata beschrieben.

Docker baut API/Web und startet als unprivilegierter Benutzer mit Migrationen. Proxy-CA nur als Build-Secret; TLS-Prüfung bleibt aktiv. AES-GCM-Backup/Restore ist lokal geprüft. Deployment-SLA, RPO/RTO, Metriken/Alerting, vollständige ASVS/WCAG-Abnahme und Windows-Installer sind ausstehend. Siehe [BETRIEB.md](BETRIEB.md) und [ANFORDERUNGSPRUEFUNG.md](ANFORDERUNGSPRUEFUNG.md).

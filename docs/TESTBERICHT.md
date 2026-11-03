# Testbericht

Dieser Bericht dokumentiert den Ausgangsstand vor Desktop 0.4.0. Die anschließenden Optimierungen und Windows-Buildprüfungen stehen in [DESKTOP_0_4_0.md](DESKTOP_0_4_0.md).

Stand: 03.11.2026. Linux x64, Node.js 24.22.1/pnpm 10.11.0 auf dem Host, PostgreSQL 16 in Docker, Playwright Chromium. Der App-Container verwendet Node 22. Native Rust-/SQLCipher-Prüfungen wurden in einem Linux-Container mit GTK/WebKit-Buildvoraussetzungen ausgeführt. Kein externer CI-, Windows-GUI- oder Produktivlauf.

## Ausgeführte Prüfungen

| Befehl / Prüfung | Tatsächliches Ergebnis |
|---|---|
| `pnpm install --frozen-lockfile` | Erfolgreich; keine erneute Versionsauflösung; gespeicherter ExcelJS-Patch berücksichtigt |
| `pnpm test` | Alle Paket-/API-/Webbuilds und 36 Kern-/Vertragstests bestanden |
| `pnpm run test:integration` | 27 echte PostgreSQL-/HTTP-/Datei-/Chromiumtests bestanden |
| `pnpm run test:load` | 1 Test mit 100.000 vollständigen Sitzungen, 100 parallelen Abgaben, SQL-Bericht und großem CSV bestanden |
| `cargo test --locked -j4 storage::tests` | 2 native SQLCipher-/Initialisierungstests bestanden |
| `pnpm run db:migrate` | 001/002 unverändert erkannt, additive 003–010 lokal angewandt; frische und wiederholte Migration zusätzlich in Tests |
| `docker build … -t surveystudio-pro:local .` | Gesamte App mit eingefrorenem Lockfile und optionalem CA-Build-Secret erfolgreich gebaut |
| `pnpm run test:container` | Node 22, Benutzer-ID 1000, frische Migrationen, DB-Health, SPA-Fallback, API-404, Registrierung und Projektpersistenz im echten Image geprüft |
| `pnpm run test:backup` | Verschlüsselter Roundtrip in neue DB, 50 Antworten mit Unicode/Originalversion/Hash und kritischen Referenzen, Wiederholungsmigration und Fremdschlüssel geprüft; manipuliertes Archiv vor DB-Anlage abgewiesen |
| `pnpm audit --prod` | 0 bekannte Befunde in allen fünf Schweregraden zum Ausführungszeitpunkt |

**63 Kern-/Integrationstests, ein Lasttest und zwei native Tests bestanden; jeweils keine fehlgeschlagenen oder übersprungenen Tests.** Container-/Backup-Helper und Builds werden zusätzlich aufgeführt und nicht als weitere Node-Einzeltests gezählt. Ein Teil der 36 Kerntests sind statische Verträge; diese ersetzen keine Featureabnahme. Vollständige letzte Ausgaben: [TESTLAUF_AUSGABE.txt](TESTLAUF_AUSGABE.txt).

## Funktionale Nachweise

- Echte Passworthashes, normalisierte E-Mails, Validierung einschließlich bcrypt-UTF-8-Grenze, CSRF, widerrufbare Sessions, Logout, Ablauf und deaktivierte Konten. Reset/Verifikation sind einmalig; Reset beendet vorhandene Sessions.
- Mandanten-Fremdschlüssel, Rollen einschließlich Analyst/Gast, keine Selbst-Hochstufung, sofortiger Rechteentzug und serialisierter Schutz des letzten Owners. Fremde Teilnehmer-/Exportzugriffe werden verweigert.
- Alle 19 Fragetypen verwenden dieselbe Validierung in Renderer/API/lokalem Store. Pflichtfehler liefern 422 und speichern keine Sitzung. Acht parallele identische Retries ergeben genau eine Sitzung; andere Payload mit gleicher Kennung ergibt Konflikt.
- AT-01: Zehn Fragen bleiben nach Logout/erneutem Login identisch gespeichert. AT-05: 50 historische Antworten behalten nach Änderung von Frage/Option ihren alten Snapshot, ihre alten Beschriftungen und korrekte Auswertung; die neue Version enthält keine alten Antworten.
- Umfrage kopieren/archivieren, Historie wiederherstellen, Kommentare erledigen, Publikationen zeitsteuern/pausieren, kanonische Retries trotz geänderter Keyreihenfolge und DB-Verbot der Snapshotänderung.
- Ergebnislinks enthalten eingefrorene Aggregate; kleine Zellen unterdrücken die ganze Frage. Widerruf ergibt 404. Keine öffentliche Rohdaten-/Filterroute.
- CSV, XLSX und PDF tatsächlich erzeugt und gelesen; Unicode einschließlich `Grüße 東京` bleibt erhalten, PDF zusätzlich über `pdftotext` geprüft. Fremder Download wird verweigert.
- ExcelJS-Streaming mit aktualisierter Archivbibliothek geprüft; permanenter Einzeilenpatch korrigiert `StreamBuf.pipe()` auf den Node-Stream-Vertrag. Echtes ZIP-Globbing/Unicode/Entpacken und XLSX-Streaming werden zusätzlich getestet. Gefälschte Größen, inkonsistente lokale ZIP-Einträge und eine stark komprimierte Datei über dem Entpacklimit werden vor XML-Import abgewiesen.
- CSV/XLSX-Teilnehmerimport mit Vorschau/Duplikaten und verschlüsselten Identitäten. Anonyme Einladungsliste erzeugt keine individuellen Einladungstoken; DB verhindert anonyme Antwortzuordnung. Persönliche Modi benötigen gültige persönliche Einladung. Hinweiszustimmung wird an die veröffentlichte Revision gebunden.
- Berichtigung, Personenexport und bestätigte Gesamtlöschung entfernen zugeordnete Antworten und invalidieren Ergebnis-/Exportartefakte. Antwort-Retention und Auditänderungsverbot tatsächlich geprüft.
- Echte SQLite-Datei nach Schließen/Öffnen unverändert; Revision, Kommentare, Kopie, Limits, CSV und Outbox geprüft. Echte SQLite→PostgreSQL-Synchronisation mit Retry ohne Doppelantwort, Konflikt und Gerätewiderruf.
- Native SQLCipher-Datei ohne Klartextheader/-testinhalt; richtiger Schlüssel öffnet dieselben Daten, falscher Schlüssel scheitert. Initialisierung ist exklusiv gesperrt. Die Tests verwenden synthetische Schlüssel, nicht den tatsächlichen OS-Schlüsselbundanbieter.
- Chromium: gespeicherter Verlaufshintergrund stimmt in Designer/Mobilvorschau/öffentlichem Renderer überein. Echter PNG-QR wird decodiert und enthält den Link. Öffentliche Pflichtfehler/Abgabe funktionieren. Registrierung, Projekt, Reload, Logout und Login bestehen ohne JavaScript-Seitenfehler. Die anfänglichen 401-Sessionabfragen vor Login sind erwartet.
- Rasterassets werden decodiert/neu kodiert; unerlaubter Typ und fremde Projekte werden abgewiesen; private Assets werden erst über passende aktive Veröffentlichung öffentlich.

Der Browservergleich deckt konkrete Pfade ab, keine vollständige visuelle Abnahme aller Varianten. Screenshot: [background-preview.png](screenshots/background-preview.png).

## Last- und Exportmessung

Synthetischer Datensatz: **100.000 Sitzungen mit je 30 ausgefüllten Fragen, insgesamt 3.000.000 Antwortwerte**; eine Textantwort umfasst 2.000 Zeichen. Danach 100 neue gleichzeitige HTTP-Abgaben mit je eigener Idempotenzkennung. Anschließend Bericht und CSV mit insgesamt 100.100 Sitzungen.

| Messung | Letzter Wert |
|---|---:|
| CPU-Quote / RAM-Limit | 4 CPU / 32 GiB |
| Vorbereitung der Daten | 63 s |
| Abgabe p50 / p95 / Maximum | 430 / **627** / 641 ms |
| SQL-Bericht mit 30 Fragen | 12.110 ms |
| Asynchrone CSV-Erzeugung | 14.355 ms |
| Heruntergeladene CSV | 277.878.032 Byte, 100.101 Zeilen einschließlich Kopfzeile |

Der CSV-Download wird vollständig gestreamt und seine Zeilenanzahl geprüft. Die Exportzeit misst Erzeugung bis Jobstatus „done“, nicht den anschließenden Download. Rohwerte: [LASTTEST_ERGEBNIS.json](LASTTEST_ERGEBNIS.json).

Der gemessene p95 unterschreitet das 2-Sekunden-Ziel auf dieser Testmaschine. **Die Maschine hat 32 GiB statt der im Pflichtenheft genannten 8-GiB-Referenz.** Dies ist kein Lastnachweis auf 8 GiB und kein Produktions-SLA. Ein einzelner 100er-Burst ersetzt keinen Dauertest. Großer CSV-Export ist belegt; 100.000-Sitzungen-XLSX und verbindliche Hardware-/Laufzeitgrenzen sind separat offen.

## Aussagegrenzen

Nicht ausgeführt: Windows-Installer/GUI/Signierung und tatsächlicher Schlüsselbundanbieter, echter SMTP-/Provider-TLS-Testversand, manuelle WCAG-/Screenreader-/Kontrastabnahme, komplette Browsermatrix, definierter 4G/Lighthouse-Lauf, ASVS/Pentest, Host-/Prozessausfall nach ACK, komplette produktive Retention/Asset-/Schlüsselsicherung und RPO/RTO/SLA. Keine externen E-Mails, Veröffentlichung oder Push.

Nicht implementierte Funktionen sind ausdrücklich im [Pflichtenheft-Abgleich](ANFORDERUNGSPRUEFUNG.md) aufgeführt. Bestandene Tests ergeben keine vollständige P0/P1-/Version-1.0-Freigabe.

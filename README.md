# SurveyStudio Pro

Entwicklungsprojekt einer deutschen Umfrageplattform mit React/TypeScript, NestJS, PostgreSQL und Tauri-/SQLite-Adapter. Die vorhandenen Fehler wurden bearbeitet und zahlreiche P0-/P1-Funktionen ergänzt. **Das gesamte Pflichtenheft und eine Produktversion 1.0 sind noch nicht vollständig umgesetzt oder abgenommen.** Der vollständige Abgleich steht in [ANFORDERUNGSPRUEFUNG.md](docs/ANFORDERUNGSPRUEFUNG.md).

## In diesem Stand nutzbar

- Anmeldung, Registrierung, widerrufbare Sitzungen, CSRF, Passwort-Reset und E-Mail-Verifikation mit einmaligen Tokens; verschlüsselte Nachrichtenwarteschlange und konfigurierbarer SMTP/TLS-Transport.
- Arbeitsbereiche, verschachtelte Projektordner, Owner/Editor/Viewer/Analyst/Gast, serverseitige Rechte und geschütztes Audit.
- Fragebogendesigner mit Reihenfolge, Kopieren/Löschen, Undo/Redo, Autosave, Revisionskonflikten, Umfragekopien, Archivierung, Versionshistorie und Kommentaren.
- **Variable Hintergründe:** Farbfläche, Verlauf, Punkte/Raster/Diagonalen, eigenes Bild, Skalierung, Position, Überlagerung und Formular-Deckkraft. Designer, Vorschau und veröffentlichte Formulare verwenden dieselbe Darstellung.
- **19 Fragetypen:** Kurz-/Langtext, Zahl, E-Mail, Datum, Ja/Nein, Einfach-/Mehrfachauswahl, Dropdown, Sterne, Slider, NPS, Likert, zwei Matrixtypen, Ranking, Bildauswahl, Datei-Upload und Terminwahl.
- Mehrere Seiten, Fortschritt, bedingte Sichtbarkeit/Pflichtfelder, UND/ODER und geprüfte Vorwärtssprünge. Ausgeblendete/übersprungene Fragen blockieren nicht und ihre Antworten werden vor dem Speichern entfernt.
- Kopf-/Fußzeilen, Begrüßung/Abschluss mit sicherer einfacher Fett-/Kursivformatierung; kein ausführbares HTML.
- Veröffentlichung mit unveränderlichen Snapshots, Link, PNG-/SVG-QR, Beginn/Ende, Pause, Schließen und Antwortlimit. Validierte Abgaben sind auch bei parallelen Retries idempotent.
- Versionierbare Auswertungen, Tabellen, Balken/Kreis/Donut, Zeitverlauf, Mittelwert/Median/Standardabweichung/NPS, Matrix-/Rankingauswertung; Diagrammexport SVG/PNG.
- Asynchrone CSV-/XLSX-/PDF-Exports mit Unicode-Schriften und berechtigten, zeitlich begrenzten Downloads.
- Getrennte Ergebnislinks mit widerrufbaren Tokens, unveränderlichem Ergebnisstand und vollständiger Unterdrückung kleiner Zellen. Keine öffentlichen Rohdaten und keine öffentlichen Datenfilter.
- Teilnehmerimport CSV/XLSX mit Duplikatvorschau; verschlüsselte Identitäten, Einladungswarteschlange, Auskunft/Berichtigung/Löschung. Anonyme Einladungen verwenden einen gemeinsamen Link und keine individuelle Abschlussverfolgung.
- Anonyme/pseudonyme/personenbezogene Modi, getrennte Zuordnung, Löschfristen und versionierte Bestätigung. Produktivveröffentlichung verlangt Verantwortlichen, Kontakt, Zweck, Rechtsgrundlage und Hinweisversion.
- Decodierte/neu kodierte Rasterbilder mit Größen-/Pixellimit, entfernten Metadaten und kontrollierter Bereitstellung.
- Lokaler SQLite-Adapter mit persistenten Projekten, Entwürfen, Abgaben, Ergebnissen und CSV; manuelle HTTPS-Synchronisation mit Gerätezugängen, Warteschlange, Retry und Konfliktanzeige. Importierte Internetfreigaben bleiben zunächst pausiert.
- AES-GCM-Backups für die lokale Docker-Datenbank und Wiederherstellung in eine neue Datenbank; vollständiges App-Dockerfile und Produktions-Compose.

## Lokal starten

Voraussetzungen: Node.js **ab 22.14**, pnpm **10.11.0**, Docker Engine/Desktop mit Compose. pnpm bei Bedarf mit `npm install --global pnpm@10.11.0` installieren. Freie Ports: 5432, 3001, 5173.

Im Repository-Verzeichnis:

```sh
pnpm install --frozen-lockfile
node scripts/configure-local.cjs
pnpm run build
docker compose up -d --wait
pnpm run db:migrate
pnpm run dev:api
```

In einem zweiten Terminal:

```sh
pnpm run dev:web
```

Die Weboberfläche liegt unter `http://localhost:5173`. Registrieren, Projekt wählen, Umfrage erstellen und über **Design** gestalten. **Verwalten** öffnet Veröffentlichung, Kommentare, Historie, Teilnehmer und Ergebnisfreigaben. **Auswertung** bietet Versionswahl und Exporte.

Die ignorierte `.env` bleibt lokal. Das Konfigurationsskript erzeugt bei Neuanlage getrennte zufällige Sitzungs-/Datenschlüssel und überschreibt bestehende Installationen nicht. Alte Entwicklungsinstallationen ohne `DATA_ENCRYPTION_KEY` verwenden weiterhin ihren bisherigen Schlüsselpfad; dessen Änderung erfordert eine kontrollierte Datenmigration. **Keine Schlüssel austauschen, ohne verschlüsselte Daten und Wiederherstellung zu berücksichtigen.**

## E-Mail und Produktivbetrieb

Ohne SMTP-Konfiguration werden Nachrichten vorbereitet und im lokalen Entwicklungspostfach unter **Konto und Nachrichten** angezeigt. Das beweist keinen externen Versand. In Produktion ist dieses Postfach abgeschaltet; nicht verifizierte Konten erhalten keinen normalen Arbeitsbereichszugriff.

Mailtransport konfigurieren über geschützte Umgebungseinstellungen: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`. Port 587 verlangt STARTTLS, Port 465 direktes TLS; Zertifikatsprüfung bleibt aktiv. Der Betreiber muss die konfigurierte Absenderidentität und SPF/DKIM/DMARC tatsächlich autorisieren. Beliebige From-Adressen können Nutzer nicht frei einsetzen. Provider-OAuth, eigene Absender pro Organisation, Bounces und Erinnerungsplanung sind noch offen.

`docker-compose.prod.yml` verlangt sichere Werte für Datenbankkennwort, `JWT_SECRET`, `DATA_ENCRYPTION_KEY` und die tatsächlichen HTTPS-Origins. Ein TLS-Reverse-Proxy gehört vor die an Host-Loopback gebundene Anwendung. SMTP-/Produktivgeheimnisse nicht ins Repository oder in Chatnachrichten schreiben.

```sh
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

In der verwalteten Cloud beim Imagebau zusätzlich das bereitgestellte CA-Zertifikat als Build-Secret übergeben; siehe [BETRIEB.md](docs/BETRIEB.md). Das Image enthält Weboberfläche, API, SQL-Migrationen und Schriften. Die Startanweisung führt Migrationen vor dem API-Start aus.

## Öffentlicher Online-Zugang

Noch kein Hosting vorhanden: Es gibt deshalb derzeit keine öffentliche Instanz. [ONLINE_BEREITSTELLUNG.md](docs/ONLINE_BEREITSTELLUNG.md) beschreibt das enthaltene HTTPS-Serverpaket mit Caddy, PostgreSQL und geschützter Erstkontoeinrichtung. Hosting und Domain werden vom Betreiber bereitgestellt. „Online-Zugang“ in der Desktop-App prüft einen eingerichteten Server und öffnet dessen Webanmeldung im Standardbrowser.

## Tests

```sh
pnpm test                         # Paket-/API-/Web-Builds und einzelne Kern-/Vertragstests
pnpm exec playwright install chromium
pnpm run test:integration          # echte PostgreSQL-, HTTP-, Export- und Browsertests
pnpm run test:load                 # separater Lasttest mit 100.000 Sitzungen / 3 Mio. Antworten
node scripts/check-backup.cjs      # lokaler Docker-Backup-/Restore-Roundtrip
```

Für die PDF-Inhaltsprüfung muss `pdftotext` verfügbar sein (Linux-Paket `poppler-utils`). Playwright benötigt auf Linux gegebenenfalls `pnpm exec playwright install --with-deps chromium`.

Die Integrationstests legen ein zufälliges PostgreSQL-Schema und eigene temporäre Dateien an und entfernen diese anschließend. Sie starten eigene API-/Vite-Prozesse; Ports 3101/5173 müssen frei sein. Der separate Lasttest verwendet 3103/5174 und belegt vorübergehend zusätzlichen Datenbankplatz für synthetische Daten. Keine echten Teilnehmerdaten werden verwendet.

[Testbericht](docs/TESTBERICHT.md), [letzte Ausgaben](docs/TESTLAUF_AUSGABE.txt) und [Hintergrundvorschau](docs/screenshots/background-preview.png) enthalten die Nachweise. Die Desktop-Pipeline baut Windows-Pakete und führt eine Installations-/Startprüfung aus. Der aktuelle Ausführungsnachweis steht beim jeweiligen GitHub-Release; historische lokale Testausgaben gelten für ihren dokumentierten Quellstand.

## Desktop

Windows-x64-Vorabversion 0.5.0: [Installationsanleitung](docs/INSTALLATION_WINDOWS.md), [Fehlerkorrekturen und Buildprüfung](docs/DESKTOP_0_5_0.md). Downloadpakete werden über [GitHub Releases](https://github.com/Sarkissian198927/SurveyStudio-Pro/releases) bereitgestellt; `build-manifest.json` und SHA256-Prüfsummen ordnen sie dem geprüften Quellstand zu.

Der Quellcode liegt unter `apps/desktop`, die echte SQLite-Domänenschicht unter `packages/desktop-store`.

```sh
pnpm --filter @surveystudio/desktop dev
pnpm --filter @surveystudio/desktop exec tauri build -- --locked
```

Benötigt werden Rust sowie die Tauri-Systemvoraussetzungen der Zielplattform. Der Rust-Code wurde unter Linux mit GTK/WebKit und Cargo-Lockfile geprüft. `.github/workflows/desktop.yml` ergänzt unter Windows einen echten Schlüsselbundtest, EXE/MSI-Build und Installations-/Fensterstarttest. Die Pipeline prüft außerdem ein Upgrade von 0.4 mit Bestandserhalt, Navigation, Umfrageerstellung, Antworten und CSV über den echten Windows-Speicherdialog sowie HTTPS-Zertifikatsprüfung und Browseröffnung. Eine vollständige manuelle Windows-Abnahme bleibt offen.

**Die native Datenbank verwendet SQLCipher und einen zufälligen Schlüssel im Betriebssystem-Schlüsselbund.** Ohne verfügbaren Schlüsselbund/Schlüssel gibt es keinen Klartextfallback. Dateiverschlüsselung und Wiederöffnung wurden nativ unter Linux geprüft; der echte Windows-Schlüsselbundanbieter und der native GUI-Ablauf werden zusätzlich in der Windows-Pipeline geprüft. Persönliche/pseudonyme lokale Veröffentlichungen bleiben wegen fehlender lokaler Identitätsverwaltung blockiert. Lokal sind CSV und grundlegende Auswertungen vorhanden; vollständige XLSX/PDF-Ausgabe, Sync-Pull, automatische Synchronisation, Lösch-Tombstones fehlen. Datenbank und Schlüssel müssen zusammen gesichert werden.

## Noch nicht vollständig

Unter anderem: strukturierter Rich-Text-Inhaltsbaum, vollständiger Dashboard-Builder, Aufgaben-/Sperrenverwaltung, bidirektionale Offline-Synchronisation, vollständige Lokalisierung, Echtzeit-Coauthoring, Kapazitäten/Wartelisten/Storno, Berechnungen/Piping/Randomisierung, Webhooks/BI, erweiterte Versionsvergleiche, KI und Enterprise-SSO/SCIM. Auch manuelle WCAG-/Screenreader-Prüfungen, ASVS-Gesamtabnahme, echte Mailzustellung, Produktions-RPO/RTO und Betriebs-SLA sind nicht nachgewiesen.

Der vollständige Quellcode ist entpackt bearbeitet; historische ZIP-Dateien und Pflichtenheft bleiben unverändert. Keine Freigabe als „SurveyStudio Pro 1.0“ und keine pauschale Datenschutz-/Produktivzertifizierung.

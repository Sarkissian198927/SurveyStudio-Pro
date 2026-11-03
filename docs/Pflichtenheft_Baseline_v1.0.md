# Technisches Pflichtenheft – SurveyStudio Pro

**Version:** 1.0 (Planungs- und Implementierungsbaseline)  
**Stand:** 03.11.2026  
**Produkt:** SurveyStudio Pro – Umfrage-, Formular-, Anmelde- und Auswertungsplattform  
**Dokumentstatus:** Umsetzungsentwurf; fachliche und rechtliche Freigabe vor Produktivbetrieb erforderlich  
**Zielgruppe:** Product Owner, KI-Programmierassistenten, Softwarearchitektur, Frontend-/Backend-Entwicklung, Testing und Datenschutz

> **Leitprinzip:** So einfach bedienbar wie Microsoft Forms, aber unabhängig implementiert, mit flexibler Gestaltung, vielfältigen Fragetypen, nachvollziehbaren Auswertungen, lokalem Betrieb und sicherer Zusammenarbeit. Dieses Dokument ist ein technischer Bauplan, keine Behauptung, dass die Software bereits entwickelt wurde.

## 1. Ziel, Ausgangslage und überprüfbare Produktdefinition

SurveyStudio Pro dient der visuellen Erstellung, Veröffentlichung, Durchführung, Verwaltung und Auswertung von Umfragen, Feedbackformularen, Anmeldelisten und Fragebögen. Zwei Betriebsarten sind verbindlich: ein webbasiertes Mehrbenutzersystem und eine lokal installierbare Desktop-Anwendung. Fragebögen sind per Link/QR-Code teilbar, Ergebnisse getrennt und kontrolliert per Link/QR-Code freigebbar. Projekte, Entwürfe, veröffentlichte Versionen und Antworten sind dauerhaft und wiederherstellbar zu speichern.

**Produktziele:** (Z1) ohne Programmierung eine einfache 10-Fragen-Umfrage in höchstens 10 Minuten erstellen und veröffentlichen; (Z2) gleiche Darstellung von veröffentlichten Fragebögen in Browser und lokaler Laufzeit; (Z3) Ergebnisse korrekt aggregieren und exportieren; (Z4) Anonymität, Pseudonymität und personenbezogene Erfassung technisch unterscheidbar machen; (Z5) Online- und Offline-Nutzung ohne unkontrollierte Datenflüsse ermöglichen.

**Zielanwender:** Einzelpersonen, Organisationen, Unternehmen, Schulen/Vereine und interne Teams; Datenschutzkonfiguration entsprechend dem jeweiligen Anwendungsfall. Hauptsprache Deutsch, Internationalisierung vorbereitet. Antwortende benötigen bei öffentlichen Umfragen kein Konto.

**Annahmen:** EU/Deutschland als anfänglicher Zielmarkt; Desktop zuerst Windows, danach macOS/Linux; zunächst ein zentraler Webserver pro Deployment, organisatorische Mandantenfähigkeit; Self-Hosting möglich. Anforderungen an spezielle Branchen (Gesundheitsdaten, Kinder, Beschäftigtenbefragung, amtliche Statistik) müssen vor Freigabe separat bewertet werden.

### 1.1 Begriffe und Betriebsgrenzen

- **Projekt:** organisatorischer Container für Umfragen und Berechtigungen.
- **Umfrage:** fachliches Objekt, das mehrere Entwurfs- und Veröffentlichungsstände haben kann.
- **Fragebogenversion:** unveränderlicher Snapshot mit Layout, Fragetypen, Logik und Validierung.
- **Veröffentlichung:** aktivierter Verweis auf genau eine veröffentlichte Version und ihre Zugriffsregeln.
- **Antwortsitzung:** einzelner Abgabevorgang; **Antwort:** gespeicherter Wert einer Frage innerhalb einer Sitzung.
- **Anonym:** keine für den Betreiber realistisch nutzbare Zuordnung der Antworten zu Personen; ist vor Aktivierung einer Befragung anhand von Metadaten, Freitext, kleinen Gruppen und Einladungswegen zu prüfen.
- **Pseudonym:** eine Zuordnung ist mit gesondert verwahrten Informationen weiterhin möglich; personenbezogene Daten bleiben geschützt zu verarbeiten.
- **Lokal:** ohne öffentlichen Server nutzbar, jedoch ohne weltweit erreichbaren Link. **Synchronisiert:** explizit oder konfiguriert mit einer Online-Instanz abgeglichen.

## 2. Lieferumfang, Priorisierung und Release-Grenzen

**Priorität P0 – Kernprodukt/MVP:** Kernsystem muss Ende-zu-Ende auf dem Websystem funktionieren; Grundlage für alle weiteren Module. **P1 – verpflichtende Produktversion 1.0:** schließt die ursprünglich geforderten Funktionen einschließlich Desktop/Offline, E-Mail, Zusammenarbeit und Datenschutzoperationen ab. **P2 – Ausbau:** erweiterte Logik, Visualisierung, Echtzeitkooperation und anspruchsvolle Anmeldeverfahren. **P3 – optional:** KI-Assistenz und Spezialintegrationen. Eine Veröffentlichung als „SurveyStudio Pro 1.0“ ist erst nach P0 *und* P1 zulässig.

### 2.1 Verbindlicher Funktionskatalog

| ID | Modul | Konkrete Anforderung | Priorität | Abnahmehinweis |
|---|---|---|---|---|
| F-001 | Identität | Registrierung/Einladung, Login, Passwort-Reset, Sitzungsende, E-Mail-Verifikation | P0 | Reset-Token nur einmal verwendbar |
| F-002 | Organisation | Mandant, Projektordner und Mitgliedschaft mit Owner-/Editor-/Viewer-Rollen | P0 | Rollen serverseitig geprüft |
| F-003 | Umfragen | Erstellen, umbenennen, duplizieren, archivieren, Entwurf speichern | P0 | Entwurf nach Neustart unverändert |
| F-004 | Designer | Drei-Spalten-Editor, Fragen hinzufügen/duplizieren/reihen/entfernen | P0 | Tastaturbedienung möglich |
| F-005 | Kernfragen | Kurz-/Langtext, Zahl, Datum, E-Mail, Ja/Nein, Single-/Multiple-Choice, Dropdown | P0 | Frontend- und Backend-Validierung gleich |
| F-006 | Gestaltung | Farben, Schrift, Fett/Kursiv, Überschriften, Logo, Hintergrundbild, Header/Footer | P0 | Mobil- und Desktopvorschau konsistent |
| F-007 | Seiten | Begrüßung, Abschluss, mehrseitiger Fragebogen, Fortschrittsbalken | P0 | Texte frei formatierbar |
| F-008 | Versionen | Publizierter Snapshot unveränderlich, erneute Veröffentlichung als neue Version | P0 | Antworten referenzieren ursprüngliche Version |
| F-009 | Publikation | Öffentlicher Link, QR-Code PNG/SVG, Start/Ende, Pausieren | P0 | QR enthält gültige freigegebene URL |
| F-010 | Antwortsystem | Validieren, absenden, idempotent speichern, Bestätigung anzeigen | P0 | Wiederholtes Absenden erzeugt kein Duplikat |
| F-011 | Basisauswertung | Absolut/relativ, Tabelle, Balken/Kreis/Donut, Zeitreihe, Fragefilter | P0 | Summen stimmen mit Rohdaten überein |
| F-012 | Export | CSV, XLSX, druckfähiger PDF-Ergebnisbericht | P0 | Unicode und Sonderzeichen erhalten |
| F-013 | Datenschutzbasis | Konfigurierbare Privacy-Modi, Löschfrist, Datenschutzhinweis, Freigabeprüfung | P0 | Anonymer Modus verhindert Teilnehmer-Antwort-FK |
| F-014 | Rechte | Projekt-/Umfrageberechtigung; getrennte Rechte für Rohdaten und Aggregate | P0 | Verweigerte API liefert 403 |
| F-015 | Ergebnisse teilen | Separater Ergebnislink/QR, Token-Widerruf, nur freigegebene Aggregate | P0 | Umfragelink öffnet keine Ergebnisse |
| F-016 | Assets | Medien-Upload mit Typ-/Größenprüfung, sichere Bereitstellung und Löschung | P0 | Aktiver Inhalt wird blockiert |
| F-017 | Autosave | Entwurfs-Autosave mit Fehlerhinweis und Revisionsschutz | P0 | Konflikt führt zu 409, kein stilles Überschreiben |
| F-018 | Desktop | Installierbare Windows-Anwendung, SQLite, vollständiger lokaler Editor und lokale Abgabe | P1 | Kernfunktionen ohne Internet |
| F-019 | Synchronisation | Manuelle/konfigurierbare Synchronisierung mit Konfliktanzeige und Offline-Queue | P1 | Keine Doppelantwort bei Retry |
| F-020 | Teilnehmer | CSV/XLSX-Import, Einladungscodes, Status, Anmeldelisten | P1 | Daten nur bei Berechtigung sichtbar |
| F-021 | E-Mail | Eigene verifizierte Absenderidentität, SMTP/OAuth, Einladung/Bestätigung/Reminder | P1 | TLS und Testversand; fehlende Zustellung sichtbar |
| F-022 | Zusammenarbeit | Projekte teilen, Kommentare, Änderungsverlauf, Aufgaben, grobe Bearbeitungssperren | P1 | Paralleländerungen nicht verlustbehaftet |
| F-023 | Erweit. Fragen | Likert, Matrix, Sterne, Slider, Ranking, NPS, Bildauswahl, Upload, Terminwahl | P1 | Darstellung und Export pro Typ getestet |
| F-024 | Logik | Sichtbarkeit, Sprünge, UND/ODER, Pflichtfeldbedingungen, Zyklenerkennung | P1 | Nie verdeckte Pflichtfrage blockierend |
| F-025 | Reporting | Dashboard-Builder, Diagrammfarben, Filter, PDF-/PNG-/SVG-Ausgabe | P1 | Bericht nur aus erlaubten Datensätzen |
| F-026 | Rechteverwaltung | Projektbezogene Rechte einschließlich Analyst und Gäste, Rollenänderungsprotokoll | P1 | Rechteentzug beendet Zugriff sofort |
| F-027 | Anonymisierung | Löschung/Entkopplung persönlicher Listen; Risikoprüfung und kleinste Gruppengröße | P1 | Reidentifizierungsrisiken sichtbar dokumentiert |
| F-028 | Datenschutzrechte | Löschen/Berichtigen/Exportieren auffindbarer Personenbezüge, Aufbewahrungsjobs | P1 | Vorgang nachweisbar, keine Daten in Logs |
| F-029 | Backup | Backup, verschlüsselte Wiederherstellung, Migrations- und Restore-Tests | P1 | RPO/RTO nach Kapitel 11 erfüllt |
| F-030 | Barrierefreiheit | WCAG 2.2 AA als Produktziel für Designer und Antwortansicht | P1 | Tastatur-/Screenreader-/Kontrasttests |
| F-031 | Audit | Unveränderbare/zugriffsgeschützte Sicherheitsereignisse, Adminansicht | P1 | Keine Antworten im Audit-Log |
| F-032 | Sprachen | Deutsche Standard-UI, lokalisierbare Umfrage- und Validierungstexte | P1 | Fallback-Locale klar definiert |
| F-033 | Erweit. Statistik | Kreuztabellen, Boxplot, Heatmap, Median, Standardabweichung, Segmentvergleiche | P2 | Skalenniveau korrekt berücksichtigt |
| F-034 | Echtzeit-Coauthoring | Live-Präsenz, segmentiertes gleichzeitiges Editieren, konfliktfreie Zusammenführung | P2 | Mehrbenutzertest mit Netzunterbrechung |
| F-035 | Anmeldung Plus | Kapazitäten, Wartelisten, Stornierung, Umbuchung, Buchungs-E-Mails | P2 | Atomare Kapazitätsprüfung |
| F-036 | Dynamik Plus | Berechnungen, Piping, Randomisierung, Summen-/Budgetfragen, komplexe Matrix | P2 | Reproduzierbares Antwortmodell |
| F-037 | Integrationen | Webhooks, API-Keys/Scopes, Power BI/BI-Export, Import von Formdefinitionen | P2 | Signierte Events, Retry und Audit |
| F-038 | Versionen Plus | Vergleich von Fragebogenversionen, kontrolliertes Migrationsmapping | P2 | Bruchstellen in Zeitvergleichen markiert |
| F-039 | KI | Fragevorschläge und aggregierte Ergebniszusammenfassungen, abschaltbar | P3 | Kein ungeprüfter Datentransfer |
| F-040 | Enterprise | SSO/SAML/OIDC, SCIM, Mandantenrichtlinien, Custom Domains | P3 | Externe Integration gesondert abgenommen |

**Explizit nicht in P0:** Live-Textkollaboration à la Google Docs; öffentliche Freigabe personenbezogener Rohdaten; automatische bidirektionale Konfliktauflösung; universelles SPSS-/R-Statistikpaket; native Android-/iOS-App; vollautomatische rechtliche DSGVO-Zertifizierung.

### 2.2 Abhängigkeiten und kritischer Pfad

F-001/002 → F-003/004/005/006/017 → F-008/009 → F-010 → F-011/012/015. Rechteprüfung und Datenschutzbasis (F-013/014) laufen ab dem ersten Sprint als Querschnittsanforderungen mit; sie dürfen nicht nachträglich aufgesetzt werden. Offline-Synchronisierung F-019 setzt stabile IDs, Versionen, Idempotenz und Konfliktregeln voraus.

## 3. Technische Referenzarchitektur

### 3.1 Verbindlicher Technologieentscheid (ADR-001)

- **Frontend Web/Renderer:** React + TypeScript + Vite; semantische HTML-Formulare, React Hook Form, Zod, zugängliche UI-Primitives; CSS-Token-System (Farben/Schriften/Abstände); dnd-kit mit alternativer Tastaturbedienung.
- **Rich Text:** TipTap oder gleichwertiger strukturierter Editor, gespeicherter zulässiger Inhaltsbaum, serverseitige Sanitization, kein frei ausführbares HTML/JavaScript.
- **Backend:** Node.js + TypeScript + NestJS, REST-API `/api/v1`, OpenAPI, zentraler Auth-/Rechte-/Audit-/Validierungs-Layer; WebSocket erst ab P2.
- **Zentrales System:** PostgreSQL als Source of Truth, Migrationen, Transaktionen, tenantgebundene Abfragen; Objekt-Storage für Uploads und Exporte; Redis/BullMQ für Jobs optional und ab E-Mail/Export empfohlen.
- **Lokal:** Tauri mit Web-UI, SQLite und lokalem Dateispeicher; separate Desktop-Adapter für Speicher, Authentifizierung und Sync. Gleiche Fragebogen-Schemas, Renderer und Logikpakete wie im Web.
- **Visualisierung:** Apache ECharts mit zugänglicher Tabellendarstellung als Alternative, Export per SVG/PNG; serverseitige Berichterstellung für PDF.
- **Monorepo:** pnpm + TypeScript mit versionierten Packages; Containersupport via Docker Compose, CI/CD für Tests/Builds.

**Architekturregel:** Fachlogik des Fragebogens muss in reinen, deterministischen TypeScript-Paketen liegen (`@surveystudio/schema`, `@surveystudio/logic`, `@surveystudio/validation`, `@surveystudio/renderer-core`), nicht an Browser- oder Datenbankbibliotheken gekoppelt.

### 3.2 Komponenten und Datenfluss

`Browser-/Tauri-UI → API-Gateway/Auth → Survey-, Publish-, Response-, Analytics-, Share-, Export-, Mail-Services → PostgreSQL/SQLite + Object Storage + Job Queue`.

Ein öffentlicher Fragebogen nutzt ausschließlich eine abgesicherte Public-API ohne Admin-Session. Ein veröffentlichter Snapshot wird aufgerufen, clientseitig angezeigt und serverseitig nochmals validiert. Der Antwortservice speichert die Einreichung in einer Transaktion; nur abgeschlossene Einreichungen fließen in die Standardauswertung ein. Auswertungslinks benutzen einen separaten Share-Service mit eigener Berechtigungsprüfung.

### 3.3 Repository und Paketstruktur

```text
surveystudio/
  apps/web/              # Admin-, Designer- und öffentliche Weboberfläche
  apps/api/              # NestJS REST API und Jobs
  apps/desktop/          # Tauri, lokaler SQLite-Adapter, Sync
  packages/schema/       # Fragebogenschema + JSON Schema + Zod
  packages/logic/        # Bedingungen/Verzweigungen/Berechnungen
  packages/renderer/     # Gemeinsame Fragetyp-Renderer und Layout
  packages/ui/           # Designsystem, Formelemente, Accessible UI
  packages/analytics/    # Kennzahlen, Gruppierung, Diagrammadapter
  packages/contracts/    # API DTOs, OpenAPI Client und Ereignisse
  packages/testing/      # Tests, Fixtures und Contract-Tests
  db/migrations/         # PostgreSQL-Migrationen
  infra/                 # Docker, Deploy, Monitoring, Backup
  docs/                  # ADRs, Handbuch, Datenschutz, Testplan
```

### 3.4 Trennung von Daten und Verantwortlichkeiten

Publizierte Fragebogenversionen sind unveränderlich. Antwortdaten referenzieren `survey_version_id` und `question_key`. Ein neues Layout oder eine Frageänderung erzeugt einen neuen Snapshot, nicht ein Überschreiben. Dateien werden separat, mit referenzierten Objekt-IDs und Ablaufregeln verwaltet. In der Desktop-App ist der Webserver nicht nötig, um bereits lokal vorhandene Entwürfe oder lokale Antworten zu bearbeiten. Lokal erstellte QR-Codes funktionieren außerhalb des lokalen Netzes erst nach Publikation auf einem öffentlich erreichbaren Server.

## 4. Fragebogenschema und Regeln des Editors

### 4.1 Kanonisches Schema

Ein Fragebogen wird als JSON-Snapshot gespeichert. Pflichteinträge: `schemaVersion`, `surveyId`, `versionId`, `locale`, `metadata`, `theme`, `pages`, `questions`, `logic`, `settings` und `privacy`. Jede Frage hat einen unveränderlichen `questionKey`, `type`, `label`, `required`, `config` und ggf. `options`, `validation`, `conditionalVisibility`.

**Fragetyp-Registry:** Pro Fragetyp sind Konfigurationsschema, Defaultwerte, Editor-Konfiguration, Renderer, Servervalidierung, Antwortserialisierung, Auswertungsadapter und Exportformat zu implementieren. Fehlende Adapter werden vor Veröffentlichung erkannt. Fragetypen dürfen keine unkontrollierten Skripte ausführen.

**MVP-Fragetypen:** `short_text`, `long_text`, `number`, `date`, `email`, `boolean`, `single_choice`, `multi_choice`, `dropdown`. **P1:** `rating`, `likert`, `matrix_single`, `matrix_multi`, `slider`, `nps`, `ranking`, `image_choice`, `file_upload`, `time_slot`. **P2:** `constant_sum`, `budget`, `calculated`, `repeating_group`, `pairwise_comparison`. Das UI zeigt nicht verfügbare Typen nicht als fertig an.

### 4.2 Beispiel einer Fragebogenversion

```json
{
  "schemaVersion": "1.0",
  "surveyId": "018f0000-0000-7000-8000-000000000001",
  "versionId": "018f0000-0000-7000-8000-000000000002",
  "locale": "de-DE",
  "metadata": {"title": "Zufriedenheit", "intro": "Willkommen", "outro": "Vielen Dank"},
  "theme": {"fontFamily": "Inter", "primaryColor": "#2457A7", "backgroundAssetId": null},
  "pages": [{"key": "p1", "title": "Bewertung", "questionKeys": ["q_rating", "q_comment"]}],
  "questions": [
    {"key": "q_rating", "type": "single_choice", "label": "Wie zufrieden sind Sie?", "required": true,
      "options": [{"value": "good", "label": "Gut"}, {"value": "bad", "label": "Schlecht"}]},
    {"key": "q_comment", "type": "long_text", "label": "Was können wir verbessern?", "required": false,
      "validation": {"maxLength": 2000}}
  ],
  "logic": [{"when": {"questionKey": "q_rating", "operator": "eq", "value": "bad"},
             "action": {"type": "show_question", "questionKey": "q_comment"}}],
  "settings": {"showProgress": true, "allowPartial": false},
  "privacy": {"mode": "anonymous", "retentionDays": 365, "privacyNoticeRevision": "v1"}
}
```

### 4.3 Validierungs- und Logikregeln

1. Schema und Werttypen werden serverseitig gegen dieselbe versionierte Definition geprüft, die im Client zur Vorschau dient.
2. Unsichtbare Fragen dürfen keine Pflichtfeldfehler auslösen und sollen nicht unbemerkt alte Antworten übermitteln; beim Verbergen wird die Antwort gemäß definierter Lösch-/Beibehaltungsstrategie behandelt (Voreinstellung: löschen).
3. Logikgraph muss vor Veröffentlichung auf unbekannte Referenzen und Zyklen geprüft werden; ungültige Konfiguration blockiert Veröffentlichung.
4. Frage- und Antwortoption-IDs sind stabile maschinenlesbare Schlüssel; sichtbare Texte können geändert werden, ohne historische Bedeutung umzuschreiben.
5. Verzweigungen sind deterministisch; zufällige Reihenfolgen benötigen bei statistischer Reproduzierbarkeit einen gesicherten Seed pro Sitzung.
6. Eine Veröffentlichung führt einen `dry-run`-Prüfbericht aus: Fragen/Validierung, Medien, Datenschutzhinweise, Rechtsgrundlage, Linkmodus, Barrierefreiheit und bekannte Risiken.

## 5. Datenbankschema (logisch und physisch)

### 5.1 Grundsätze

PostgreSQL für das Websystem; SQLite erhält semantisch äquivalente lokale Tabellen oder einen explizit dokumentierten Adapter. Primärschlüssel sind generierte UUIDs; Zeitangaben werden UTC gespeichert; `organization_id` ist bei mandantenbezogenen Tabellen obligatorisch. Fachliche Verknüpfungen müssen mandantenübergreifende Referenzen verhindern. `deleted_at` ist nur bei Objekten sinnvoll, bei denen rechtliche Löschvorgaben eine gesonderte physische Löschroutine zulassen.

**Versionen:** `surveys.current_draft_version_id` zeigt auf den aktuellen editierbaren Stand. `survey_versions` enthält Status `draft|published|retired`, Versionsnummer, Revision und Snapshots. Bei Publikation wird ein neuer unveränderlicher Datensatz erstellt. Alle Antworten verweisen auf die veröffentlichte ID, niemals auf einen frei bearbeitbaren Entwurf.

### 5.2 Tabellenkatalog

| Tabelle | Schlüssel und wesentliche Felder | Zweck/Relation |
|---|---|---|
| `organizations` | `id PK`, `name`, `settings_json`, `created_at` | Mandant |
| `users` | `id PK`, `email UNIQUE`, `password_hash`, `verified_at`, `status` | Login und Identität |
| `organization_members` | `id`, `organization_id FK`, `user_id FK`, `role`, `status` | Mandantenzugehörigkeit |
| `projects` | `id`, `organization_id FK`, `name`, `owner_id`, `archived_at` | Projekte |
| `project_members` | `project_id FK`, `user_id FK`, `role`, `permissions_json` | Projektberechtigung |
| `surveys` | `id`, `organization_id`, `project_id`, `title`, `state`, `privacy_mode`, `current_draft_version_id` | Umfrage-Stamm |
| `survey_versions` | `id`, `survey_id`, `version_no`, `revision`, `status`, `schema_json`, `schema_hash`, `published_at` | Versionierter Snapshot |
| `survey_question_index` | `version_id`, `question_key`, `type`, `label`, `page_key`, `ordinal` | Suche/Auswertung; aus Snapshot ableitbar |
| `themes` | `id`, `organization_id`, `name`, `tokens_json` | Designvorlagen |
| `assets` | `id`, `organization_id`, `object_key`, `mime_type`, `size_bytes`, `checksum`, `scan_status` | Medien und Uploads |
| `publications` | `id`, `survey_id`, `survey_version_id`, `slug`, `status`, `opens_at`, `closes_at`, `max_responses` | Öffentliche Freigabe |
| `access_tokens` | `id`, `publication_id/report_share_id`, `token_hash`, `purpose`, `expires_at`, `revoked_at`, `uses` | Geheime Link-/Invite-Credentials |
| `invitees` | `id`, `organization_id`, `survey_id`, `email_encrypted`, `name_encrypted`, `status` | Getrennter Identitätsbereich |
| `invitations` | `id`, `invitee_id`, `publication_id`, `token_hash`, `sent_at`, `redeemed_at` | Einladungsverwaltung |
| `response_sessions` | `id`, `organization_id`, `survey_id`, `survey_version_id`, `publication_id`, `status`, `submitted_at`, `idempotency_key` | Einzelne Abgabe; im Anonymous-Modus ohne Teilnehmer-FK |
| `response_items` | `id`, `session_id`, `question_key`, `answer_json`, `value_type` | Validierte Antworten |
| `participant_links` | `id`, `session_id`, `invitee_id`, `created_at` | Nur bei identifiable/pseudonymous erlaubt; physisch getrennt |
| `reports` | `id`, `organization_id`, `survey_id`, `name`, `definition_json`, `owner_id` | Gespeicherte Berichte |
| `report_shares` | `id`, `report_id`, `access_mode`, `scope_json`, `expires_at`, `revoked_at` | Ausschließlich gesonderte Ergebnisfreigabe |
| `email_identities` | `id`, `organization_id`, `address`, `verified_at`, `secret_ref`, `provider` | Autorisierter Absender |
| `email_templates` | `id`, `organization_id`, `event_key`, `subject`, `body_json` | Mail-Vorlagen |
| `email_jobs` | `id`, `organization_id`, `template_id`, `recipient_ref`, `status`, `attempts`, `last_error_code` | Nachvollziehbarer Versand |
| `audit_events` | `id`, `organization_id`, `actor_id`, `action`, `resource_type`, `resource_id`, `occurred_at` | Rechte-/Sicherheitsaudit |
| `data_retention_jobs` | `id`, `organization_id`, `scope`, `due_at`, `status`, `completed_at` | Löschsteuerung |
| `sync_devices` | `id`, `organization_id`, `user_id`, `device_key`, `last_sync_at` | Autorisierte lokale Geräte |
| `sync_operations` | `id`, `device_id`, `entity_type`, `entity_id`, `base_revision`, `operation_json`, `status` | Offline-Änderungsjournal |
| `outbox_events` | `id`, `organization_id`, `event_type`, `payload_json`, `created_at`, `processed_at` | Transaktionale Events/Jobs |

**Wichtige Einschränkung:** `participant_links` darf für `privacy_mode = anonymous` nicht angelegt werden. Einladungstokens und deren Einlösungen dürfen im Anonymous-Modus weder in `response_sessions` noch in Telemetrie, Jobdaten oder Audit-Logs mit Einreichungs-IDs zusammengeführt werden. Zusätzliche Prüfung ist nötig, ob enge Zeitstempel oder seltene Merkmale dennoch Zuordnungen erlauben.

### 5.3 Beziehungen, Indizes, Constraints

- `organization_members (organization_id, user_id)` UNIQUE; `project_members (project_id, user_id)` UNIQUE.
- `survey_versions (survey_id, version_no)` UNIQUE; `survey_question_index (version_id, question_key)` UNIQUE.
- `publications.slug` UNIQUE; URLs dürfen keine fortlaufenden internen IDs offenlegen.
- `response_sessions (publication_id, idempotency_key)` UNIQUE WHERE `idempotency_key IS NOT NULL`; alle Schreibwiederholungen idempotent behandeln.
- `response_items (session_id, question_key)` UNIQUE bei nicht wiederholbaren Fragen; für Wiederholungsgruppen später `item_path` ergänzen.
- Index auf `response_sessions (organization_id, survey_id, submitted_at)`; Index auf `(session_id, question_key)` in `response_items`.
- `access_tokens.token_hash` UNIQUE; nur kryptografischer Hash gespeichert, Roh-Token nur bei Erstellung angezeigt.
- Mandanten-FKs und optional PostgreSQL Row Level Security; Anwendung muss `organization_id` außerdem selbst zuverlässig erzwingen.
- Publizierte Versionen sind durch DB-Trigger oder restriktive Schreibpfade vor Änderungen geschützt.
- `audit_events` append-only für reguläre Benutzer; administrative Korrekturen separat protokollieren.

### 5.4 Beispiel-SQL – tragfähiger P0-Kernausschnitt

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE survey_privacy AS ENUM ('anonymous', 'pseudonymous', 'identifiable');
CREATE TYPE survey_state AS ENUM ('draft', 'in_review', 'published', 'paused', 'closed', 'archived');
CREATE TYPE version_state AS ENUM ('draft', 'published', 'retired');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id)
);
CREATE TABLE surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  title text NOT NULL,
  state survey_state NOT NULL DEFAULT 'draft',
  privacy_mode survey_privacy NOT NULL DEFAULT 'anonymous',
  current_draft_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id)
);
CREATE TABLE survey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  survey_id uuid NOT NULL,
  version_no integer NOT NULL CHECK (version_no >= 1),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  status version_state NOT NULL DEFAULT 'draft',
  schema_json jsonb NOT NULL,
  schema_hash char(64) NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, version_no),
  UNIQUE (id, organization_id),
  FOREIGN KEY (survey_id, organization_id) REFERENCES surveys(id, organization_id),
  CHECK ((status <> 'published') OR published_at IS NOT NULL)
);
ALTER TABLE surveys ADD CONSTRAINT fk_current_draft_version
  FOREIGN KEY (current_draft_version_id, organization_id)
  REFERENCES survey_versions(id, organization_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  survey_id uuid NOT NULL,
  survey_version_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('active','paused','closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  max_responses integer CHECK (max_responses > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (survey_id, organization_id) REFERENCES surveys(id, organization_id),
  FOREIGN KEY (survey_version_id, organization_id) REFERENCES survey_versions(id, organization_id),
  CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)
);
CREATE TABLE response_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  survey_id uuid NOT NULL,
  survey_version_id uuid NOT NULL,
  publication_id uuid NOT NULL REFERENCES publications(id),
  status text NOT NULL CHECK (status IN ('in_progress','submitted','void')),
  idempotency_key text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (survey_id, organization_id) REFERENCES surveys(id, organization_id),
  FOREIGN KEY (survey_version_id, organization_id) REFERENCES survey_versions(id, organization_id),
  UNIQUE (publication_id, idempotency_key),
  CHECK ((status <> 'submitted') OR submitted_at IS NOT NULL)
);
CREATE TABLE response_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES response_sessions(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  answer_json jsonb NOT NULL,
  value_type text NOT NULL,
  UNIQUE (session_id, question_key)
);
CREATE INDEX ix_sessions_survey_date
  ON response_sessions (organization_id, survey_id, submitted_at)
  WHERE status = 'submitted';
CREATE INDEX ix_items_session_key ON response_items(session_id, question_key);
```

**Implementierungshinweis:** Dies ist ein lauffähiger Kernschnitt, nicht die vollständige Produktionsmigration. Alle weiteren Tabellen aus 5.2 sowie Fremdschlüssel, Löschroutinen, row-level policies und Integritätsprüfungen sind in nachfolgenden Migrationen umzusetzen. Zusätzlich muss beim Anlegen einer `publication` der Datensatz `survey_version` nachweislich veröffentlicht sein; diese übergreifende Invariante wird transaktional im Service geprüft. `survey_version_id` und `survey_id` müssen ebenfalls fachlich zusammenpassen. SQL-Migrationen sind gegen reale PostgreSQL-Testdatenbank zu testen.

## 6. API-Verträge und Integrationsarchitektur

### 6.1 Gemeinsame Regeln

- REST-Basis `/api/v1` mit OpenAPI 3.x; alle Admin-Endpunkte verlangen authentifizierte Sitzung, CSRF-Schutz bei Cookie-Authentifizierung und serverseitige Autorisierung. Public-Endpunkte besitzen getrennte Policies und Rate-Limits.
- IDs als UUID; JSON in UTF-8; Zeitangaben ISO-8601/UTC; Pagination per Cursor; Filter und Sortierung nur über ausdrücklich erlaubte Felder.
- Einheitliche Fehlerstruktur: `{ "error": { "code": "VALIDATION_FAILED", "message": "...", "details": [] }, "requestId": "..." }`; Benutzertexte auf Deutsch, maschinenlesbare Codes stabil.
- `400` Syntaxfehler, `401` Authentifizierung fehlt, `403` kein Recht, `404` unbekannt/nicht sichtbar, `409` Revisionskonflikt, `410` abgelaufen/widerrufen, `422` fachliche Validierung, `429` Ratelimit, `500` ohne Interna.
- Mutierende Entwurfsoperationen benutzen `If-Match`/Revision oder `expectedRevision`. Einreichungen benutzen `Idempotency-Key`, um Netzwerk-Retries ohne Doppelabgabe zu erlauben.
- Alle export- oder mailintensiven Aufträge sind asynchron: `202 Accepted` plus `jobId` und Status-Endpoint; Download-Links sind kurzlebig.

### 6.2 API-Endpunktkatalog

| Methode | Pfad | Berechtigung / Funktion |
|---|---|---|
| `POST` | `/auth/login` | Benutzeranmeldung; Session-Cookie |
| `POST` | `/auth/logout` | Sitzung widerrufen |
| `POST` | `/auth/password-reset/request` | Reset mit neutraler Antwort |
| `GET` | `/me` | Eigene Identität und Berechtigungen |
| `GET/POST` | `/projects` | Projektübersicht/Neuanlage |
| `GET/PATCH` | `/projects/{projectId}` | Projektdaten ändern |
| `GET/POST` | `/projects/{projectId}/members` | Projektberechtigte anzeigen/einladen |
| `GET/POST` | `/projects/{projectId}/surveys` | Umfragen lesen/anlegen |
| `GET/PATCH` | `/surveys/{surveyId}` | Umfragemetadaten |
| `GET/PATCH` | `/surveys/{surveyId}/draft` | Entwurf und Revision |
| `POST` | `/surveys/{surveyId}/validate` | Veröffentlichungsvorprüfung |
| `POST` | `/surveys/{surveyId}/publish` | Unveränderlichen Snapshot aktivieren |
| `POST` | `/publications/{publicationId}/pause` | Freigabe pausieren |
| `POST` | `/publications/{publicationId}/close` | Freigabe schließen |
| `GET` | `/public/forms/{slug}` | Öffentliche Fragebogendefinition ohne interne Metadaten |
| `POST` | `/public/forms/{slug}/submissions` | Validierte Antwort einreichen |
| `GET` | `/surveys/{surveyId}/results` | Aggregierte Resultate nach Berechtigung |
| `GET` | `/surveys/{surveyId}/responses` | Rohantworten nur mit explizitem Recht |
| `POST` | `/surveys/{surveyId}/exports` | Exportjob anstoßen |
| `GET` | `/jobs/{jobId}` | Asynchronen Jobstatus abrufen |
| `POST` | `/surveys/{surveyId}/report-shares` | Ergebnisteilung erstellen |
| `DELETE` | `/report-shares/{shareId}` | Link widerrufen |
| `GET` | `/public/reports/{shareToken}` | Ausschließlich freigegebenen Ergebnisumfang lesen |
| `POST` | `/assets/upload-intents` | Sicheres Uploadziel reservieren |
| `POST` | `/assets/{assetId}/complete` | Upload/Scan abschließen |
| `GET/POST` | `/surveys/{surveyId}/invitees` | Teilnehmende verwalten, nur befugt |
| `POST` | `/surveys/{surveyId}/invitation-batches` | Einladungs-Mailjobs |
| `GET/POST` | `/email-identities` | Autorisierte eigene Absender verwalten |
| `GET/POST` | `/sync/changes` | Synchronisationsjournal abgleichen |
| `GET` | `/audit-events` | Administratives, begrenztes Audit |

**Kontrollregel:** `GET /public/reports/...` liefert nie rohe Antwortobjekte oder Identitätsdaten; weder UI-Parameter noch manipulierte Querystrings dürfen die Freigabescopes erweitern.

### 6.3 Beispiel: Einreichung

```http
POST /api/v1/public/forms/satisfaction-7c82/submissions
Idempotency-Key: 03faf511-0f2e-4c92-99d6-4be2b7d6c040
Content-Type: application/json
```

```json
{
  "versionId": "018f0000-0000-7000-8000-000000000002",
  "answers": [
    {"questionKey": "q_rating", "value": "good"},
    {"questionKey": "q_comment", "value": "Schnelle Unterstützung."}
  ],
  "locale": "de-DE"
}
```

**Erfolg:** `201 Created` mit `{ "submissionReceipt": "public-random-ref", "acceptedAt": "..." }`; in anonymen Befragungen enthält der Beleg keinen auslesbaren Teilnehmerbezug. Der Server prüft Publikationsstatus, Zeitfenster, Größenlimits, Version, Fragenliste, sichtbare Pflichtfragen, Typen und Berechtigungen. Er schreibt die Sitzung und Antworten atomar. Ein Retry mit gleicher Idempotenzkennung und identischem Inhalt gibt das ursprüngliche Resultat zurück; ein abweichender Payload mit gleichem Key liefert `409`.

### 6.4 Ereignisse und Nebenläufigkeit

Nach erfolgreicher Einreichung schreibt der Server `submission.accepted` in eine transaktionale Outbox. Worker aktualisieren Aggregations-Caches und lösen erlaubte Benachrichtigungen aus. E-Mails werden niemals allein aus einem unbestätigten Browserereignis verschickt. Ein Worker-Retry darf keine mehrfachen Bestätigungsmails erzeugen. Gleichzeitige Antworten an der Kapazitätsgrenze werden transaktional oder per kontrollierter Reservierung auf das Limit begrenzt.

## 7. Bildschirm- und Navigationskonzept

### 7.1 Navigationssystem

**Primärnavigation (links):** Dashboard · Meine Umfragen · Vorlagen · Teilnehmer/Anmeldungen · Ergebnisse · Berichte · Zusammenarbeit · Verwaltung. **Globale Kopfzeile:** Organisationswechsel · Suche · Benachrichtigungen · Hilfe · Profil. **Kontextnavigation (oben):** Projekt / Umfrage / Modul / aktueller Status. Auf Mobilgeräten werden Admin-Menüs verdichtet; die Antwortansicht ist vollständig mobilfähig.

**Breadcrumbs und Zustandsinformation:** Der Benutzer muss jederzeit Projekt, Umfrage, Status (Entwurf/Veröffentlicht etc.) und Speicherstatus erkennen. Warnungen bei ungespeicherten Änderungen, abgelaufenen Links und unsicheren Berechtigungen sind sichtbar.

### 7.2 Verbindlicher Screen-Katalog

| ID / Route (Beispiel) | Inhalt und Hauptaktionen | Wichtige Zustände |
|---|---|---|
| S-01 `/login` | Anmeldung, Passwort vergessen, Kontoverifikation | Fehler, gesperrt, MFA optional |
| S-02 `/dashboard` | Neu anlegen, letzte Umfragen, Antworten, offene Aufgaben | Leerzustand, laufende Umfragen |
| S-03 `/projects` | Projekte als Liste/Kacheln, Suche/Filter/Archiv | Keine Projekte, kein Zugriff |
| S-04 `/projects/:id/surveys` | Umfrageliste mit Status, Eigentümer, Anzahl Antworten | Entwurf, aktiv, pausiert, archiviert |
| S-05 `/surveys/new` | 3-Schritt-Assistent: Titel, Vorlage, Privacy-/Zugangsmodus | Pflichtangaben, Datenschutzwarnung |
| S-06 `/surveys/:id/designer` | Fragenbibliothek links, Canvas Mitte, Eigenschaften rechts | Autosave, Konflikt, Validierungsfehler |
| S-07 `/surveys/:id/design` | Hintergrund, Schrift, Farben, Logo, Layouttemplates | Sofortvorschau, Kontrastwarnung |
| S-08 `/surveys/:id/logic` | Bedingungseditor, Verzweigungsgraph, Logikprüfung | Zyklus, verwaiste Referenz |
| S-09 `/surveys/:id/preview` | Desktop/Tablet/Mobil; echter Renderer mit Testdaten | Kein persistenter Produktiv-Submit |
| S-10 `/surveys/:id/publish` | Veröffentlichung, Zeitraum, Rollen, Link, QR-Code | Vorprüfung fehlgeschlagen, aktiv |
| S-11 `/f/:slug` | Öffentliches responsives Ausfüllen | Start, in Bearbeitung, bestätigt, geschlossen |
| S-12 `/surveys/:id/participants` | CSV-Import, Einladungen, Teilnehmerstatus, Anmeldungen | Duplikate, Einladungsfehler |
| S-13 `/surveys/:id/results` | KPI-Karten, Diagramme, Filter, Rohdaten-Tab | Wenige Antworten, suppressed groups |
| S-14 `/surveys/:id/reports` | Dashboard-/Berichtseditor, Exportjobs | Job läuft, fehlgeschlagen, bereit |
| S-15 `/surveys/:id/sharing` | Fragebogen-/Ergebnislinks getrennt, QR, Widerruf | Abgelaufen, gesperrt, unsicher |
| S-16 `/projects/:id/team` | Mitglieder, Rollen, Einladungen, Kommentarhistorie | Ausstehend, entfernt, Besitzerwechsel |
| S-17 `/settings/email` | SMTP/OAuth, Absenderverifikation, Mailvorlagen | Test erfolgreich/fehlgeschlagen |
| S-18 `/surveys/:id/privacy` | Verarbeitungszweck, Modus, Löschfrist, Rechtsgrundlage | Fehlende Angaben, Sperre vor Publish |
| S-19 `/settings/sync` | Lokaler Status, Sync-Queue, Abgleich, Konflikte | Offline, ausstehend, Konflikt, Fehler |
| S-20 `/admin/security` | Audit, Sitzungskontrolle, Schlüsselrotation, Backups | Nur Admin, Export protokolliert |

### 7.3 Wireframe: Fragebogen-Designer (S-06)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Projekt › Umfrage › Designer   [ENTWURF]    Gespeichert 08:41    [Vorschau] [Veröffentl.] │
├─────────────────┬─────────────────────────────────────────┬──────────────────────────────┤
│ FRAGEN          │ LEINWAND                               │ EIGENSCHAFTEN                │
│ + Einfachwahl   │ ┌─────────────────────────────────────┐ │ Fragetext                    │
│ + Mehrfachwahl  │ │ Kundenzufriedenheit                │ │ [Wie zufrieden sind Sie?]    │
│ + Text          │ │ Einleitungstext ...                 │ │ Typ: Einfachwahl            │
│ + Zahl          │ │ 1. Wie zufrieden sind Sie?         │ │ [x] Pflichtfeld             │
│ + Datum         │ │ ○ Sehr zufrieden                   │ │ Antworten:                  │
│ + Bewertung     │ │ ○ Zufrieden                        │ │ [Sehr zufrieden]   [↑][×]   │
│ + Matrix        │ │ ○ Unzufrieden                      │ │ [+ Antwort]                 │
│                 │ │ [+ Frage hinzufügen]               │ │ Bedingung [Konfigurieren]    │
│ VORLAGEN        │ └─────────────────────────────────────┘ │                              │
│ Abschnitte      │ [+ Seite hinzufügen]                    │ [Duplizieren] [Löschen]      │
└─────────────────┴─────────────────────────────────────────┴──────────────────────────────┘
```

**Detailverhalten:** Die Leiste links ist auswählbar und per Tastatur nutzbar. Ein Klick auf eine Frage öffnet rechts typabhängige Einstellungen. Autosave zeigt „Speichert … / Gespeichert / Fehler“. Es existieren Undo/Redo, Duplikation, Frageverschiebung und eine Vorschau mit echter Validierung. Die Fragestruktur wird nicht allein aus dem DOM extrahiert, sondern ausschließlich aus dem kanonischen Schema erzeugt.

### 7.4 Wireframe: Ergebnisse (S-13)

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Ergebnisse › Kundenzufriedenheit                   [Filter] [Bericht] [Export] [Teilen]│
├────────────────────────────────────────────────────────────────────────────────────┤
│ [248 Antworten] [84 % abgeschlossen] [Ø 4,2 / 5] [Letzte Antwort: heute]             │
├───────────────────────────────────────┬────────────────────────────────────────────┤
│ Zufriedenheit                         │ Trend der Antworten                         │
│ [Balken-/Donut-Diagramm]               │ [Linien-/Flächendiagramm]                  │
├───────────────────────────────────────┴────────────────────────────────────────────┤
│ Frage | Diagrammtyp | Gruppierung | Sortierung | Anzeige als barrierefreie Tabelle    │
│ Filter: [Zeitraum] [Version] [Merkmal]        [Filter zurücksetzen]                │
│ Datenschutz: Kleine Gruppen ausgeblendet (Schwelle: 5; konfigurierbar)              │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Alle Ergebnisfilter sind serverseitig autorisiert. Bei kleinen Gruppen wird statt eines konkreten Werts „Nicht ausweisbar“ angezeigt. CSV/PDF-Exporte übernehmen dieselbe Sichtbarkeits- und Datenschutzpolitik; ein Export darf keine versteckten Werte zurückbringen.

### 7.5 Zentrale Benutzerabläufe

**Flow A – Umfrage erstellen:** Dashboard → Neu → Titel/Vorlage → Privacymodus auswählen → Designer → Vorschau → Validierung → Veröffentlichung → Link/QR kopieren. Abbruch jederzeit als Entwurf gespeichert.

**Flow B – Teilnehmen:** QR/Link → Begrüßungs-/Datenschutzseite → Fragen nach Konfiguration → Validierung → Absenden → Abschlussseite → optional autorisierte Bestätigung per Mail. Bei Unterbrechung nur dann fortsetzen, wenn entsprechender Modus aktiviert und technisch vereinbar ist.

**Flow C – Ergebnis freigeben:** Ergebnisse → Aggregierte Ansicht konfigurieren → Datenschutzprüfung → Freigabeberechtigung/TTL/Passwort → Ergebnisshare erstellen → QR/Link versenden → jederzeit widerrufen.

**Flow D – Lokal arbeiten:** Desktop starten → Lokales Projekt bearbeiten/Umfrage lokal durchführen → Synchronisationsstatus prüfen → Serverziel auswählen → Vorschau der Änderungen/Konflikte → kontrolliert hochladen. Ohne freigegebene Online-Publikation kein öffentlicher Internetlink.

## 8. Rollen, Rechte und Sicherheitsmodell

### 8.1 Minimaler Rechtekatalog

| Recht | Owner | Admin | Editor | Analyst | Viewer | Teilnehmende |
|---|---|---|---|---|---|---|
| Projekt verwalten | Ja | Delegiert | Nein | Nein | Nein | Nein |
| Fragen/Layout bearbeiten | Ja | Ja | Ja | Nein | Nein | Nein |
| Fragebogen veröffentlichen | Ja | Ja | Konfigurierbar | Nein | Nein | Nein |
| Aggregierte Ergebnisse ansehen | Ja | Ja | Konfigurierbar | Ja | Bei Freigabe | Nein |
| Personenbezogene Rohdaten lesen | Explizite Freigabe | Explizite Freigabe | Nein | Separates Recht | Nein | Nein |
| Rohdaten exportieren | Explizite Freigabe | Explizite Freigabe | Nein | Separates Recht | Nein | Nein |
| Berechtigungen vergeben | Ja | Delegiert | Nein | Nein | Nein | Nein |
| Fragebogen absenden | Nur bei Freigabe | Nur bei Freigabe | Nur bei Freigabe | Nur bei Freigabe | Nur bei Freigabe | Nach Zugangsmodus |

`role` allein genügt nicht. Die API nutzt feingranulare Permissions (`survey:edit`, `survey:publish`, `result:aggregate:read`, `response:raw:read`, `response:export`, `participant:manage`, `share:create`, `permission:manage`). Mitgliedschaft, Ressourcenzugehörigkeit und Datenschutzmodus werden bei jedem Aufruf geprüft. Owner erhält nicht automatisch Zugriff auf separate Identitätslisten, wenn die Organisationsrichtlinie eine Freigabe verlangt.

### 8.2 Geheimnisse, Zugriffstokens und QR-Codes

Öffentliche Links bekommen kryptografisch sichere Zufallswerte; geheimhaltungsbedürftige Tokens mit mindestens 256 Bit Entropie, im Backend nur gehasht gespeichert. Die QR-Darstellung enthält nur die URL, ist kein eigener Berechtigungsweg. Bei Ergebnisfreigaben: Scopes, Ablaufdatum, optional Passwort, Revocation, Zugriffszählung unter Datenminimierung. Keine personenbezogenen Werte in URL-Querystrings; keine fremden Inhalte in Redirects. Optional `Referrer-Policy: no-referrer` für Token-Seiten, möglichst keine Drittanbieter-Ressourcen.

### 8.3 Schutzmaßnahmen

TLS, sichere Cookies (`HttpOnly`, `Secure`, `SameSite`), Passwort-Hashing mittels Argon2id, Rate-Limits, MFA zumindest für privilegierte Konten, CSP, CSRF-Schutz, Requestlimits, Upload-Quarantäne, Malware-Prüfung und serverseitige Dateityp-Erkennung. Secrets nur via Secret Manager/OS-Keychain, nie im Klartext in Logs, Frontend oder Repository. Audit protokolliert Berechtigungsänderungen, Exporte, Löschungen, Veröffentlichung und Adminzugriffe, aber keine Antwortinhalte.

**Verifikation:** Sicherheitsplan an OWASP ASVS 5.0 ausrichten, für produktive Anwendungen Level 2 als Zielprofil festlegen und Abweichungen dokumentieren. Ein unabhängiger Penetrationstest ist vor Öffnung für sensible Befragungen ein eigener Release-Gate.

## 9. Datenschutz, Anonymität, Einwilligung und Aufbewahrung

### 9.1 Drei explizite Erhebungsmodi

**Anonym:** Keine technische Person-Antwort-Verknüpfung, keine Antwort-IP in Datenbank oder Analytics, keine Tracking-Cookies für Befragte, keine Token-ID im Antwortdatensatz. Server-Access-Logs müssen entsprechend verkürzt/entkoppelt konfiguriert werden; zur Spam-Abwehr dürfen nur eng begrenzte, flüchtige Schutzdaten verarbeitet werden. Einladungslisten können getrennt existieren, dürfen aber nicht über Zeitpunkte oder IDs mit Antwortdaten verbunden werden. Anonymität wird nicht garantiert, wenn Freitext, rare Merkmale, exakte Zeiten oder kleine Zielgruppen faktisch identifizierend sind; dies muss die UI klar kommunizieren.

**Pseudonym:** Identitätszuordnung liegt in getrenntem Verzeichnis oder separater Schutzdomäne; nur spezifisch Berechtigte können die Mapping-Tabelle einsehen. Exportstandard ist pseudonymisiert, nicht klarnamig.

**Personenbezogen:** Antworten sind bewusst Teilnehmern zugeordnet; Hinweis, Rechtsgrundlage, Empfängerkreis, Speicherdauer und Zugriff müssen konfiguriert werden. Dies ist der passende Modus für verbindliche Anmeldungen mit Bestätigungs-E-Mail.

**Besonderer Zielkonflikt:** Strikte Einmalteilnahme per persönlichem Link kann bei gleichzeitig garantierter Anonymität nur mit entkoppelter Token-Einlösung realisiert werden. Individuelle nachträgliche Antwortkorrektur oder „eigene Antworten per E-Mail“ darf in wirklich anonymen Befragungen nicht als uneingeschränkte Standardfunktion erscheinen.

### 9.2 Governance- und Datenschutzanforderungen

- Verantwortlicher, Kontaktdaten, Verarbeitungszweck, Rechtsgrundlage (nicht automatisch „Einwilligung“), Speicherdauer und optionale Datenschutzhinweise vor Veröffentlichung festlegen.
- Konfigurierbare Zustimmungs-/Kenntnisnahmeelemente mit versionsgebundener Protokollierung nur soweit rechtlich erforderlich; erforderliche Rechtsgrundlage und zusätzliche Einwilligungen nicht vermischen.
- Datenexport und -löschung für identifizierbare Personen als Workflow mit Berechtigungsprüfung, Bestätigung und Audit; bei tatsächlich anonymisierten Antworten besteht keine personenbezogene Suchzuordnung mehr.
- Aufbewahrungsplan je Datentyp (Antworten, Einladungen, Uploads, Audit, Backups), Löschfristen automatisch ausführen, Backup-Retention gesondert behandeln.
- Datenschutzfolgenabschätzungs-Unterstützung: Checkliste und Dokumentationsfelder; tatsächliche Bewertung bleibt Aufgabe des Verantwortlichen.
- Keine externe Analyse-/KI-/Tracking-Integration ohne gesonderte Freigabe und erforderliche Rechtsgrundlage, ggf. Auftragsverarbeitungsvertrag und Drittlandtransferprüfung.
- Ergebnisfreigaben standardmäßig aggregiert, mit Mindestzellgröße und ergänzender Suppression, damit Differenzen aus Gesamtsummen unterdrückte Zellen nicht rekonstruieren.

**Rechts- und Standardbezug:** DSGVO, insbesondere Art. 5, 6, 13/14, 17, 25, 28, 32, 35 und ggf. 44 ff.; EDPB-Leitlinien zu Pseudonymisierung sowie die 2026 zur Konsultation gestellten Anonymisierungsleitlinien. Keine pauschale Zusicherung „DSGVO-konform“ ohne Prüfung von Einsatzkontext und Betrieb.

## 10. E-Mail, Teilnehmer und Veranstaltungsszenarien

**E-Mail-Konfiguration:** Verifizierter Absender via SMTP/TLS oder Provider-OAuth; Zugangsdaten verschlüsselt und serverseitig; Testmail, Versandstatus, Retry, Bounce-/Fehleranzeige. Eine beliebige „From“-Adresse darf nicht ohne Kontrolle eingesetzt werden. Hilfetexte zu SPF/DKIM/DMARC und Providerlimits anbieten. Vorlagen: Einladung, Erinnerung, Bestätigung, Warteliste (P2), Ergebnisabschluss. Jede Vorlage hat Vorschau für Desktop/Mobil, Variablen-Whitelist und Testversand.

**E-Mail-Datenschutz:** In anonymen Befragungen sind Einladungs- und Bestätigungsmails strikt vom Antwortspeicher getrennt. Eine personenbezogene Antwortkopie per Mail verlangt den entsprechend markierten Modus. E-Mail-Adressen von Teilnehmern müssen nicht zwingend für die Teilnahme erhoben werden.

**Anmeldelisten:** P1: Name, Kontaktfelder, begrenzbare Anmeldefelder, CSV-/XLSX-Import, Duplikatvorschau, Anmeldung, Status und Export. P2: atomare Plätzevergabe, Wartelistenreihenfolge, Storno/Umbuchung, termingebundene Bestätigungen und lokale Zeitzonen. Eine Anmeldung ist nicht mit einer klassischen anonymen Umfrage gleichzusetzen; das Produkt kennzeichnet dies im Erstellungsassistenten.

## 11. Nichtfunktionale Anforderungen und Betrieb

| ID | Qualitätsziel | Mess-/Abnahmekriterium |
|---|---|---|
| NFR-01 | Performance | Für eine 30-Fragen-Umfrage bei 100 parallelen Nutzern: p95 Abgabe-API ≤ 2 s unter dokumentierter Testhardware und Testdatenmenge |
| NFR-02 | Seitenstart | Mobile öffentliche Formularansicht: LCP-Ziel ≤ 2,5 s unter definiertem 4G/Lighthouse-Testprofil, ohne große Medien |
| NFR-03 | Skalierung | Mind. 100.000 vollständige Antwortsitzungen pro Deployment im Staging testbar; Reporting darf nicht alle Rohdaten in den Browser laden |
| NFR-04 | Verfügbarkeit | Ziel 99,5 % monatlich für betriebene Webinstanz, abhängig von Hosting/SLA; Wartung dokumentieren |
| NFR-05 | Backup | Produktionsziel RPO ≤ 24 h und RTO ≤ 4 h; mindestens quartalsweise Restore-Test |
| NFR-06 | Verlässlichkeit | 0 Datenverlust bei validiertem Abgabe-ACK im vorgesehenen Ausfalltest; Retry idempotent |
| NFR-07 | Sicherheit | ASVS 5.0 Level 2 als Ziel; kritische Findings vor Produktivfreigabe behoben |
| NFR-08 | Barrierefreiheit | WCAG 2.2 AA für öffentliche Formulare und zentrale Admin-Flows; manueller Test mit Tastatur und Screenreader |
| NFR-09 | Geräte | Aktuelle unterstützte Versionen von Chrome, Firefox, Edge und Safari; Desktop Windows zuerst; responsive bis 320 px |
| NFR-10 | Wartbarkeit | Strikte TypeScript-Typisierung, API-/Schema-Contract-Tests, nachvollziehbare Migrationen und ADRs |
| NFR-11 | Beobachtbarkeit | Strukturierte Logs, Request-ID, Metriken, Gesundheitschecks, Alerting; keine PII in Telemetrie |
| NFR-12 | Export | Export bis 100.000 Sitzungen asynchron und speicherschonend; Laufzeitgrenze abhängig von Testhardware festzulegen |
| NFR-13 | Betriebsfähigkeit | Docker-Deployment und Tauri-Installer reproduzierbar; Rollback-Plan und Migrationsbackups |
| NFR-14 | Lokalisierung | Deutsch vollständig; neutrale Übersetzungskeys; lokale Datums-, Zeit- und Zahlenformatierung |

**Messkontext:** Referenz-Staging zunächst 4 vCPU/8 GB RAM mit separat ausgewiesener Datenbank-/Storage-Konfiguration; HTTP-Lasttest mit 30 Fragen, einer Textfrage bis 2.000 Zeichen, 100 gleichzeitigen virtuellen Nutzern und mindestens 100.000 bestehenden Einreichungen. Zielwerte sind Abnahmeanforderungen, keine gemessenen Ist-Werte.

### 11.1 Deployment, Wartung und Betrieb

- Umgebungen: lokal, Test/CI, Staging, Produktion mit getrennten Secrets und Daten.
- Datenbankmigrationen auf Kopie prüfen; vor irreversibler Änderung Backup und Rollback-Dokumentation.
- Verschlüsselte Backups, Zugriffskontrolle, Monitoring von Speicher, E-Mail-Queue und ausstehenden Löschjobs.
- Security-Updates und Abhängigkeits-Scans kontinuierlich; SBOM für Releases; Lizenzprüfung insbesondere für verwendete Fonts, Charts, Office-/PDF-Bibliotheken.
- Konfiguration externer Domains, Proxy, CORS, HTTPS und Dateigrößenlimits dokumentieren.
- Sicherheitsereignisse nach Incident-Runbook behandeln; Datenschutzverletzungen nach konkreten Pflichten und Fristen bewerten.

## 12. Lokaler Betrieb und Synchronisation – verbindliches Konzept

**Desktop-Funktionsumfang P1:** Projekte, Fragen, lokale Vorlagen, Gestaltung, Vorschau, lokal veröffentlichte Kiosk-Umfrage, lokale Datensätze, lokale Auswertung und Export. Bei Aktivierung eines Internetlinks erfolgt Upload/Publikation auf dem gewählten Server mit explizit sichtbaren Datenschutzfolgen. Online-E-Mails und öffentliche Internetfreigaben funktionieren offline naturgemäß nicht.

**Sync-Strategie:** (1) Jede lokal erzeugte Entität erhält eine global eindeutige ID. (2) Jede Änderung wird in einer lokalen Outbox mit `baseRevision`, `operationId`, Autor und Zeitpunkt gehalten. (3) Server prüft Rechte, Schema und Revision. (4) Entwurfsänderungen mit gleichem Vorfahren und Konflikt erzeugen eine Konfliktkopie/ausgewählten Merge; kein blindes Last-Write-Wins. (5) Antworten sind append-only mit stabiler `submissionId` und idempotentem Import. (6) Gelöschte Objekte brauchen Tombstones, damit sie nicht beim nächsten Sync zurückkehren. (7) Das Gerät kann bei Rechteentzug keine weiteren Serverdaten abrufen; lokale gespeicherte Daten benötigen gesondertes Gerätemanagement/Löschkonzept.

**Sicherheitsregel:** Lokale Datenbank bei vertraulichen Daten verschlüsseln, Schlüssel via OS-Keychain/Passphrase; geschützte lokale Backups. Synchronisation nur über TLS mit authentifiziertem Gerätekontext. Automatische Synchronisation ist standardmäßig **aus**, bis Benutzer/Organisation sie aktiviert.

## 13. Teststrategie, Definition of Done und Abnahme

### 13.1 Testpyramide

- **Unit-Tests:** Regelauswertung, Fragevalidierung, Statistik, Permissions, Ser-/Deserialisierung, Datums-/Zeitzonenfälle.
- **Contract-Tests:** API-DTOs/OpenAPI, Fehlercodes, Datenbankmigrationen, Kompatibilität `schemaVersion`.
- **Integrationstests:** Transaktionsgrenzen, Limits, Einmalabgabe, E-Mail-Jobs, Imports, Exporte, Datenlöschung, RLS.
- **E2E-Tests:** Playwright über Desktop-/Mobil-Breakpoints; in P1 zusätzlich Tauri/SQLite-Smoke- und Sync-Tests.
- **Security-/Privacy-Tests:** Fremdmandant-Zugriff, IDOR/BOLA, direkte Export-URL, Tokenablauf, Rollendowngrade, Upload, anonymes Antwortmodell, unterdrückte Zellen.
- **A11y-Tests:** Axe automatisiert plus manuelle Tastatur-, Fokus-, Screenreader- und Kontrasttests; Drag-and-Drop mit alternativer Steuerung.

### 13.2 Abnahmefälle (mindestens)

| Test-ID | Ablauf | Erwartetes Ergebnis |
|---|---|---|
| AT-01 | User registriert sich, erstellt Projekt und Entwurf mit zehn Fragen | Nach Abmeldung und erneutem Login identisch vorhanden |
| AT-02 | Layoutfarbe, Schrift, Hintergrund, Text und Logo ändern | Vorschau in Desktop/Mobil entspricht gespeicherter Konfiguration |
| AT-03 | Unvollständige Pflichtantwort senden | `422`, sichtbare barrierefreie Fehlermeldung, keine gespeicherte Abgabe |
| AT-04 | Fragebogen veröffentlichen, QR scannen, absenden | QR öffnet richtige Version; gültige Antwort exakt einmal gespeichert |
| AT-05 | Nach 50 Abgaben Frage/Option ändern | Alte 50 Antworten bleiben an alter Version und Auswertung korrekt zuordenbar |
| AT-06 | Einreichung mit gleicher Idempotenzkennung wiederholen | Nur eine Sitzung; gleiche Antwort auf Retry |
| AT-07 | Fremdnutzer ruft `/responses`/Export eines anderen Mandanten auf | `403`/`404`; keine Daten preisgegeben |
| AT-08 | Öffentliches Ergebnis teilen und später widerrufen | Nur erlaubte Aggregate sichtbar, danach Zugriff `410`/`404` |
| AT-09 | Kleine Gruppe und differenzierbare Gesamtsummen filtern | Unterdrückte Werte nicht per Filter/Export rekonstruierbar |
| AT-10 | Anonyme Umfrage mit Einladungsliste durchführen | Keine technische Verknüpfung zwischen Antwortsitzung und Invitee in DB/Logs |
| AT-11 | Eigene verifizierte E-Mail einrichten, Test und Bestätigung auslösen | Versand-/Fehlerstatus sichtbar; keine Fremdadresse nutzbar |
| AT-12 | Parallelbearbeitung mit Versionskonflikt | Eindeutiger 409-/Konfliktdialog; keine stille Datenüberschreibung |
| AT-13 | Windows-App offline starten, Umfrage beantworten, Daten exportieren | Ohne Internet funktionsfähig; Ergebnisse lokal persistent |
| AT-14 | Desktop offline ändern, online synchronisieren, erneut synchronisieren | Genau eine Kopie jeder Antwort; Konflikte klar gemeldet |
| AT-15 | Löschfrist einer personenbezogenen Befragung erreichen | Löschauftrag wirkt auf Daten, Assets und zugehörige Identitätsverknüpfung gemäß Policy |
| AT-16 | Ergebnisdiagramm als PDF/PNG/SVG exportieren | Lesbar, beschriftet, gleiche berechtigte Daten wie UI |
| AT-17 | Tastatur- und Screenreader-Bedienung im Fragebogen | Frage-/Fehlerbezeichnungen semantisch korrekt, Fokusreihenfolge logisch |
| AT-18 | Datenbank wiederherstellen und Migrationen ausführen | Integrität, Anzahl der Abgaben und kritische Referenzen unverändert |

**Definition of Done je Story:** Umgesetzt + typisiert + Code Review + Unit-/Integrationstest + relevante E2E-Checks + Server-Permissions + i18n + A11y-Kontrollen + Datensparsamkeitsprüfung + OpenAPI-Dokumentation + Fehlerzustände + migrationssicher + Benutzerhinweis. „Fertig“ ohne ausführbaren Testnachweis ist nicht erlaubt.

## 14. Iterativer Implementierungsplan

| Sprintblock | Inkrement | Ergebnis/Gate |
|---|---|---|
| I-01 | Monorepo, CI, Docker, DB-Migration, Auth, Tenant-Rollen | Nutzer kann sich anmelden und Projekt anlegen |
| I-02 | Schema-Registry, Survey-CRUD, Entwurf/Autosave, Versionierung | Fragen speichern und erneut laden |
| I-03 | Designer, Layouttokens, Live-Vorschau, mobile Renderer | 10-Fragen-Demo auf Desktop/Mobil |
| I-04 | Publish-Service, Link/QR, Public-Renderer, serverseitiger Submit | Öffentliche E2E-Abgabe möglich |
| I-05 | Statistik, Diagramme, CSV/XLSX/PDF, Ergebnis-Share | MVP-Demo inkl. sicherem Link zur Auswertung |
| I-06 | Datenschutz-Basis, Audit, Security- und A11y-Härtung | P0-Abnahme und Freigabereview |
| I-07 | Tauri/SQLite, lokale Projekte/Antworten, Export | Nachweis echter Offline-Betrieb |
| I-08 | Sync-Journal, Konfliktauflösung, Lösch-Tombstones | Wiederholbarer Offline/Online-Test |
| I-09 | Teilnehmerlisten, SMTP/OAuth, Vorlagen, Bestätigung | Einladung/Bestätigung mit eigener Adresse |
| I-10 | Rollen/Kommentare, erweiterte Fragearten und Bedingungen | Gemeinsame Arbeit ohne Versionsverlust |
| I-11 | Berichtseditor, Datenschutzprozesse, Backup/Restore | Vollständige P1-Funktionsprüfung |
| I-12 | Performance, Penetrationstest, a11y, Dokumentation, Release | Freigabe „SurveyStudio Pro 1.0“ |

Die Sprintblöcke sind ein Abhängigkeitsplan und **keine pauschale Zeit- oder Kostenzusage**. Nach jedem Block werden Code, Tests, Demo, Migrationen, offene Risiken und technische Schulden dokumentiert.

## 15. Erweiterungen gegenüber dem ursprünglichen Masterprompt

Folgende ursprünglich fehlende oder nur unzureichend konkretisierte Aspekte sind ausdrücklich aufgenommen:

1. Mandantenfähigkeit mit Datenisolation und eigentlicher serverseitiger Rechteprüfung.
2. Unveränderbare Versionen veröffentlichter Fragebögen inklusive Antwort-Zuordnung.
3. Fehlertolerante, idempotente Einreichung und transaktionale Antwortspeicherung.
4. Eigene Trennung von Umfragelink, persönlichem Einladungstoken und Ergebnislink.
5. Realistisches Datenschutzmodell für anonyme, pseudonyme und personenbezogene Erhebung.
6. Unterdrückung kleiner Ergebnisgruppen und Schutz gegen Rekonstruktion durch Filter.
7. Schutz vor Export- und Freigabe-Umgehung per direktem API-Aufruf.
8. Konkrete Offline-/Online-Synchronisation mit Konflikt- und Löschstrategie.
9. Freigegebene, verifizierte E-Mail-Absender statt beliebiger Absenderadresse.
10. Sicherheits- und Qualitätsziele mit messbaren Abnahmebedingungen.
11. Konkrete Fragetyp-Plugin-Schnittstellen und Schema-Versionierung.
12. Importvalidierung, Upload-Malware-/MIME-Prüfung und sichere Asset-Verwaltung.
13. Hintergrundjobs und Outbox für Export, E-Mail und Auswertung.
14. Vollständige Fehler-, Leerlauf-, Lade- und Konfliktzustände in den Screens.
15. Accessibility nicht nur für die Antwortansicht, sondern auch im Designer.
16. Reproduzierbare Deployment-, Backup-, Wiederherstellungs- und Migrationsprozesse.
17. Zeitzonen-, Sprach- und Zeichensatzregeln.
18. Klarer Funktionsschnitt zwischen Kernprodukt und späteren Ausbaustufen.
19. Testbarkeit auch bei sehr vielen Antworten und gleichzeitigen Zugriffen.
20. Betriebsdokumentation, Auditierbarkeit, Incident-Prozesse, SBOM und Lizenzprüfung.

## 16. Offene Entscheidungen, die vor Produktivfreigabe zu protokollieren sind

| ID | Entscheidung | Vorgeschlagener Standard | Warum relevant |
|---|---|---|---|
| O-01 | Betriebsmodell | Self-Hosted plus optional Managed Hosting | Klärt Verantwortlichkeit/Support |
| O-02 | Lokaler Zugriffsschutz | OS-Keychain + verschlüsselte lokale Datenbank | Lokale PII-Sicherheit |
| O-03 | Kollaboration | P1 optimistische Revision + Kommentar, P2 Echtzeit | Vermeidet Sync-Komplexität im Kern |
| O-04 | Standard-Privacy | „Anonym“ für allgemeines Feedback, „personenbezogen“ für Anmeldungen | Nutzer darf Risiken nicht falsch verstehen |
| O-05 | Personenbezug und IP-Logs | Kein Antwort-IP-Logging; Infrastrukturlogs begrenzen | Privacy by Default |
| O-06 | Kleinste Ergebnisgruppe | Zunächst 5 als konfigurierbarer Sicherheitswert, fachliche Prüfung obligatorisch | Schutz vor Rückschluss, kein Universalschutz |
| O-07 | Löschfristen | Projekt-/Umfrage-Policy, keine universelle Zwangsfrist | Abhängig von Verarbeitungszweck |
| O-08 | Max. Uploadgröße | Pro Mandant/Fragetyp konfigurierbar, Basislimit 10 MB | Kosten und Sicherheit |
| O-09 | Wiederaufnahme | Nur bei geeigneter Datenschutzkonfiguration | Vermeidet verdecktes Identitätstracking |
| O-10 | Lizenzen und Kosten | Bibliotheken/Schriftarten/Provider vor Go-live prüfen | Rechtssicherheit und TCO |

**Grundsatz für KI-Entwicklung:** Solange keine fachliche Entscheidung vorliegt, dokumentiere die Annahme als ADR und implementiere eine konservative, datenschutzfreundliche Standardeinstellung. Erfinde keine Zustimmung oder fertige Complianceprüfung.

## 17. Vorgegebener Arbeitsauftrag an eine Programmier-KI

> **Implementierungsauftrag, Phase I-01.** Verwende dieses Pflichtenheft als Source of Truth. Erstelle zuerst das Monorepo mit Apps `web`, `api`, `desktop` und Paketen `schema`, `logic`, `renderer`, `ui`, `contracts`, `analytics`. Implementiere ausschließlich den notwendigen produktionsnahen Kern von I-01: lokale Docker-Entwicklungsumgebung für PostgreSQL, echte Schema-Migrationen, API mit OpenAPI, Authentifizierung, Mandanten- und Projektverwaltung, Rollen-/Rechte-Middleware, minimale responsive Start-/Login-/Projektseiten und Unit-/Integrationstests. Keine Mock-Daten als Ersatz für persistente Funktion ausgeben. Definiere die gewählten Bibliotheksversionen in Lockfiles, lege `.env.example` ohne Secrets an und beschreibe konkrete Startbefehle. Liefere den vollständigen Quellcode, ausgeführte Testbefehle, Testresultate, bekannte Einschränkungen und ein Mapping zu den IDs F-001/F-002/NFR-10. Danach I-02 erst nach erfolgreicher Abnahme beginnen.

## 18. Verbindliche Quellen und Referenzstandards

- Europäische Union: Datenschutz-Grundverordnung (EU) 2016/679 – https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Europäischer Datenschutzausschuss: Anonymisierung/Pseudonymisierung; u. a. Konsultationsentwurf „Guidelines 02/2026 on Anonymisation“ – https://www.edpb.europa.eu/topics/ai-and-technology/anonymisation-pseudonymisation_en
- W3C: Web Content Accessibility Guidelines (WCAG) 2.2 – https://www.w3.org/TR/WCAG22/
- OWASP: Application Security Verification Standard 5.0.0 – https://asvs.owasp.org/

Die genannten Dokumente sind Orientierungs- und Prüfmaßstäbe. Die fachliche Umsetzung und der konkrete Betreiberkontext bestimmen, welche rechtlichen Anforderungen im Einzelfall gelten.

---

**Ende des technischen Pflichtenhefts – Version 1.0.**

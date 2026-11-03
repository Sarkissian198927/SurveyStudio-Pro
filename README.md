# SurveyStudio Pro – Entwicklungsprojekt v0.1.0

**Tatsächlich implementiertes Software-Grundgerüst mit Fragebogen-Designer.** Dieses Repository ist ein startbares Webprojekt, **keine vollständig produktionsfertige Software** und **noch keine Desktop-Anwendung**. Die Phasen P1–P3 des Pflichtenhefts stehen aus.

## Was ist bereits enthalten?

- **React + TypeScript + Vite:** Deutsche Benutzeroberfläche, Anmeldung, Dashboard, Fragenbibliothek, Drei-Spalten-Designer, Eigenschaften- und Designeditor, Drag-and-Drop, Pfeiltasten-Reihenfolge, Duplizieren/Löschen, Rückgängig/Wiederholen, Vorschau, Fragebogenansicht und Ergebnisdashboard.
- **Neun Fragetypen:** Kurztext, Langtext, Zahl, E-Mail, Datum, Ja/Nein, Einfachauswahl, Mehrfachauswahl, Dropdown.
- **Gestaltung:** Farben, fünf Schriftfamilien/Fallbacks, Logo/Hintergrundbild (PNG/JPG/WebP bis 1,4 MB), Fragefett/-kursiv und Textfarben, individuelle Begrüßungs-/Abschlusstexte, Hilfetexte, Pflichtfelder und Antwortoptionen.
- **NestJS API:** Registrierung/Anmeldung, sichere Passworthashes, HttpOnly-Sitzungscookies mit CSRF-Prüfung, Projektmitgliedschaft, serverseitige Rechte, Fragebogen-Speicherung mit Revisionskontrolle, Veröffentlichung, öffentliche Teilnahmeseite und serverseitige Antwortvalidierung.
- **PostgreSQL:** Versionierte SQL-Migration, Organisationen, Benutzer, Projekte, Mitgliedschaften, Umfrageentwürfe, unveränderliche Veröffentlichungssnapshots, Antwortsitzungen, Antworten und Audit-Grundstruktur.
- **Freigabe:** Jeder Veröffentlichungsvorgang erzeugt einen eigenen Link und QR-Code (PNG). Antwortübermittlung ist über eine Idempotenz-ID gegen doppelte Speicherung geschützt.
- **Auswertung:** Automatische Anzahl, Einfach-/Mehrfachauswahl als Balken, Ja/Nein, numerischer Mittelwert; für andere Typen nur Antwortanzahl. Die Auswertung bezieht sich auf die neueste Veröffentlichungsversion.
- **Gemeinsamer Schema-/Validierungskern** unter `packages/shared`, mit Node-Tests.

## Voraussetzungen

1. **Node.js 22 LTS oder neuer** und npm.
2. **Docker Desktop** (Windows/macOS) bzw. Docker Engine + Compose (Linux) für eine lokale PostgreSQL-Datenbank; alternativ eine selbst eingerichtete PostgreSQL-16+-Instanz.
3. Für erstmaliges `npm install` eine Internetverbindung zur npm Registry.
4. Freie Ports: **5173** (Web), **3001** (API), **5432** (Datenbank).

> Die hier ausgelieferte ZIP-Datei enthält den Quellcode und Tests, **keine `node_modules`** und keine fertige Windows-EXE. Die Paketinstallation war in der Erstellungsumgebung nicht möglich (npm-Registry nicht erreichbar). Deshalb konnte die komplette React-/NestJS-Anwendung hier nicht gestartet oder als vollständig getestet ausgewiesen werden. Die paketfreien Kernlogiktests wurden geprüft; siehe `docs/TESTBERICHT.md`.

## In wenigen Schritten starten

Öffne ein Terminal im entpackten Projektordner:

```bash
# 1) Abhängigkeiten installieren
npm install

# 2) Konfiguration anlegen
cp .env.example .env

# 3) JWT_SECRET in .env durch einen mindestens 32 Zeichen langen Zufallswert ersetzen.
# Beispiel für einen Zufallswert auf macOS/Linux:
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

# 4) PostgreSQL lokal starten
docker compose up -d

# 5) Datenbanktabellen anlegen
npm run db:migrate

# 6) Terminal A – NestJS API starten
npm run dev:api

# 7) Terminal B – React-Weboberfläche starten
npm run dev:web
```

Unter Windows PowerShell `.env.example` so kopieren:

```powershell
Copy-Item .env.example .env
```

**Anwendung:** http://localhost:5173

Registriere dort ein neues Konto. Bei der Registrierung werden automatisch ein Arbeitsbereich und ein Beispielprojekt angelegt. Lege dann eine Umfrage an, füge Fragen hinzu und teste den Designer.

## Tests

```bash
npm test                   # Node-Kernlogik- und statische Projektvertragsprüfungen; ohne npm install möglich
npm run build              # kompiliert API und Web (erst nach npm install)
npm run check              # Tests + Builds
```

Die Tests für die Datenbank und die End-to-End-Browserabläufe können erst nach Installation der externen Abhängigkeiten sowie Start einer PostgreSQL-Instanz ausgeführt werden. Testvorlagen und manuelle Abnahmefälle: `docs/TESTPLAN.md`.

## Projektstruktur

```text
apps/web/                    React-Oberfläche (Vite)
apps/web/src/Designer.tsx    Visueller Fragebogen-Designer
apps/web/src/SurveyForm.tsx  Vorschau / öffentliches Formular
apps/web/src/Results.tsx     Ergebnisdashboard / öffentliche Teilnahme
apps/api/                    NestJS REST API
apps/api/src/auth.ts         Registrierung, Login, Sitzungen und CSRF
apps/api/src/surveys.ts      Umfragen, Entwürfe, Veröffentlichung, Aggregate
apps/api/src/public.ts       Öffentliche Umfrage und idempotente Antwortabgabe
packages/shared/             Gemeinsame Schema- und Antwortvalidierung
db/migrations/               Versionierte PostgreSQL-Schemata
db/migrate.cjs               Migration-Runner (mit SHA256-Veränderungsschutz)
docs/                        Architektur, Tests und Einschränkungen
```

## Sicherheitshinweise für echten Produktivbetrieb

**Nicht ohne weitere Maßnahmen öffentlich mit echten sensiblen Teilnehmerdaten bereitstellen.** Vor Produktivbetrieb fehlen bzw. erfordern Prüfung: Rate Limiting und Spam-/Abuse-Schutz, Mailverifikation und Passwort-Reset, dezidiertes Asset-Storage statt eingebetteter Bilddaten, Mandanten-Isolationstests, sichere Reverse-Proxy-/TLS-Konfiguration, automatisierte Löschjobs und Backups, Monitoring und Notfallplanung, Threat Modeling, Penetrationstests, vollständige Datenschutzprozesse, Unterdrückung kleiner Ergebnisgruppen, datenschutzrechtlich geprüfte Protokollierung sowie Last- und Barrierefreiheitstests. Außerdem sind externe Datenbankzugänge, Geheimnisse, Passwortrichtlinien und Hostingkonfigurationen entsprechend zu härten.

**Wichtiger Hinweis zur Anonymität:** Dieses Entwicklungsprojekt speichert in anonymen Fragebögen keinen Benutzer- oder Einladungsschlüssel bei Antworten; trotzdem können Freitextinhalte und der Zugriff auf Serverlogs eine Identifikation erlauben. Die Anwendung garantiert noch keine wirksame Anonymität unter sämtlichen Einsatzbedingungen.

## Nächste Implementierungsschritte

1. Technische Integrationstests/End-to-End-Tests gegen PostgreSQL und Browser erstellen und ausführen.
2. Rich-Text-Editor mit sicherer struktureller Darstellung und serverseitiger Sanitization.
3. Mehrseitige Fragebögen, Verzweigungslogik, zusätzliche Fragetypen, Schema-Migration.
4. Mehrbenutzer-Kollaboration und feingranulare Bericht-Freigaben.
5. CSV/XLSX/PDF-Export und Ergebnislinks/QR-Codes.
6. Desktop-/Offline-Version mittels Tauri/SQLite einschließlich geprüfter Synchronisation.
7. Vollständige Datenschutz- und Betriebsfreigabe.

Details und Entscheidungen: `docs/ARCHITEKTUR.md`, `docs/TESTPLAN.md`, `docs/UMSETZUNGSSTATUS.md`.

## Sofort ausprobieren – ohne Installation

Öffne **`demo/SurveyStudio_Designer_Demo.html`** direkt im Browser (Doppelklick). Diese bewusst separate Offline-Demo benötigt **weder Docker noch npm**. Sie unterstützt neun Fragetypen, Fragebearbeitung, Reihenfolge, Farbgestaltung, Live-Vorschau sowie einen lokal im Browser gespeicherten Entwurf und JSON-Export/-Import. **Wichtig:** Die Demo verwendet nur Browser-Speicherung, hat keine Benutzerverwaltung, keine serverseitige Antwortspeicherung und erstellt keine teilbaren Umfragelinks. Für den eigentlichen Webbetrieb die oben beschriebenen Installationsschritte verwenden.

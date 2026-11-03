# Testplan und ausstehende Abnahme

Ausgeführte Resultate stehen in [TESTBERICHT.md](TESTBERICHT.md), der vollständige Soll-/Ist-Abgleich in [ANFORDERUNGSPRUEFUNG.md](ANFORDERUNGSPRUEFUNG.md). Dieser Plan ist kein Ausführungsnachweis.

## Automatische Prüfschichten

1. `pnpm install --frozen-lockfile`: Pakete, Integritätswerte und ExcelJS-Patch reproduzierbar installieren.
2. `pnpm test`: strikte Paket-/API-/Webbuilds, Schema-/Logik-/Bedingungs-/Dateiprüfungen, Rollenverträge, echte lokale SQLite-Persistenz, Archivkompatibilität und ZIP-Bombenabwehr.
3. `pnpm run test:integration`: zufälliges PostgreSQL-Schema, Migrationen frisch und wiederholt, echte API, Auth/CSRF/Mandanten/Rollen, Versionsbindung nach 50 Abgaben, alle 19 Fragetypen, Exportdateien, Datenschutz, Outbox-Sync und Chromiumabläufe. Ports 3101/5173 müssen frei sein.
4. `pnpm run test:load`: separates Schema mit 100.000 vollständigen Sitzungen und 3.000.000 Antworten, 100 parallele neue Abgaben, SQL-Aggregation und großer CSV-Export. Ports 3103/5174; viel zusätzlicher DB-Platz. Hardware und Messwerte protokollieren; synthetische Daten allein ergeben keine Produktions-SLA.
5. `pnpm run test:container`: zuvor gebautes Image mit eigener DB starten, Web-/API-/Session-/Projektpfade prüfen und Testressourcen entfernen. Port 3005, lokale Compose-DB; HTTP-Testmodus ersetzt keinen TLS-Nachweis.
6. `pnpm run test:backup`: lokalen verschlüsselten Backup-Roundtrip in neue DB und Manipulationserkennung prüfen; laufende Datenbank wird nicht überschrieben.
7. Native Rust-Prüfung unter `apps/desktop/src-tauri`: `cargo test --locked storage::tests`; SQLCipher-Dateiverschlüsselung, Wiederöffnung/falscher Schlüssel und Initialisierungssperre. Plattform-Buildvoraussetzungen siehe Desktop-README.
8. `pnpm audit --prod`: bekannte Advisories zum Ausführungszeitpunkt prüfen; ersetzt keinen Code-/Penetrationstest.

Keine Tests dürfen echte Teilnehmerdaten oder vorhandene fremde Datenbanken löschen. Integrations-/Lasttests räumen ihre zufälligen Schemas und eigenen temporären Dateien auf. SMTP-Konfiguration ist in Testfixtures ausdrücklich deaktiviert.

## Noch manuell oder extern erforderlich

- Alle Designeraktionen, reduzierte Textformatierung und sämtliche Hintergrund-/Logo-Varianten bei 320 px bis Desktop mit Tastatur prüfen.
- Screenreader (z. B. NVDA/VoiceOver), Fokus, Fehlermeldungen und Kontraste nach WCAG 2.2 AA; Chrome, Edge, Firefox und Safari.
- Echte QR-Kamera auf mehreren Mobilgeräten und sichtbarer Vergleich von PNG/SVG/PDF-Berichten mit UI.
- Zwei Browserfenster: simultanes Ändern, 409-Konfliktdialog und Wiederaufnahme ohne Datenverlust.
- Windows-Installer bauen/installieren, echter Schlüsselbundanbieter, Offline-GUI, Schlüsselsicherung/Restore, anschließend HTTPS-Sync und Rechteentzug.
- Autorisierter SMTP-Absender mit TLS-Testversand, Zustellfehlern und Empfängerzustimmung; keine fremde Absenderidentität.
- Prozess-/Hostausfall nach bestätigter Antwort, erneuter Start und idempotenter Retry.
- Definiertes 4G-/Lighthouse-Profil, 8-GiB-Referenzlast, 100.000-Sitzungen-XLSX und verbindliche Exportlaufzeiten.
- Vollständiger Restore mit Antworten/Referenzen, Assets, Schlüsseln, Folge-Migration und dokumentiertem RPO/RTO.
- Reidentifizierungsrisiken, kombinierte Freigaben und Retention sämtlicher Identitäts-/Mail-/Asset-/Backup-Daten fachlich abnehmen.
- ASVS 5.0 L2, Penetrationsprüfung, Betriebsrollen, Monitoring/Alerts, produktive HTTPS-Konfiguration und SLA.

Nicht implementierte Funktionen bleiben zusätzlich offen; Tests ersetzen deren Umsetzung nicht. Dazu gehören insbesondere Sync-Pull/Tombstones, Dashboard-Builder, Echtzeitbearbeitung, erweiterte Anmeldelogik/Dynamik, Webhooks, Versionsmapping, vollständige Lokalisierung sowie optionale KI-/Enterprise-Anbindungen.

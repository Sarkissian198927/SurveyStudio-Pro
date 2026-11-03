# Desktop 0.4.0 – Änderungen und Bereitstellung

Windows-x64-Vorabversion von SurveyStudio Pro. Der Nutzerauftrag umfasst Optimierung, Fehlerkorrektur sowie die Bereitstellung eines Installationspakets über GitHub. Die produktive Webumgebung wird dafür nicht verändert. Der vollständige Pflichtenheftumfang bleibt teilweise offen.

## Behobene Fehler und Verbesserungen

- Lokale Freigabe, Archivierung, Teilnahme-Einstellungen und Erstinitialisierung laufen als atomare SQLite-Transaktionen. Ein Revisionskonflikt oder Speicherfehler rollt Snapshot, Publikation und Outbox gemeinsam zurück.
- Lokale Freigabe liefert die neue Revision an den Designer zurück. Anschließende Bearbeitung verursacht keinen künstlichen 409-Konflikt. Doppelklick und Autosave während der Freigabe werden koordiniert.
- Erneute Freigabe schließt alte lokale Links. Archivierte Umfragen sind geschlossen und können erst nach Wiederherstellung geändert oder freigegeben werden.
- Lokaler CSV-Export berücksichtigt die gewählte Fragebogenversion. Ungültige oder fremde Versionen werden abgewiesen.
- Dashboard-Antwortzahlen werden in SQLite gezählt. Auswertungen laden nur Antworten ihrer Version. Die Outbox wird pro Abruf auf 200 Vorgänge und ungefähr 10 MB begrenzt; weitere Seiten werden nach vollständiger Serverbestätigung übertragen.
- Datei- und Diagrammexport verwenden im Desktop einen echten Speicherdialog. Abbrechen meldet keinen erfolgreichen Export. PNG umfasst auch bei langen Diagrammen die volle Höhe.
- Lokale Freigabe öffnet den Fragebogen innerhalb der App. Sie wird nicht als öffentlicher QR-/Internetlink ausgegeben. Nicht verfügbare Webfunktionen werden im lokalen Modus ausgeblendet.
- Bestätigtes lokales Löschen entfernt Antworten und noch nicht synchronisierte Antwortoperationen. Die Oberfläche erklärt, dass bereits übertragene Serverdaten bestehen bleiben.
- Speicherfehler werden nicht mehr pauschal als Revisionskonflikt behandelt; nach einem vorübergehenden Fehler kann Speichern ohne Neuladen erneut versucht werden.
- Speicherfehler beim Erststart werden mit Wiederholoption angezeigt. Eine fehlgeschlagene Initialisierung bleibt nicht dauerhaft als abgelehntes Promise zwischengespeichert.
- Integrierte Hilfe, deutscher Installer, EXE/MSI-Paketierung, Lizenzhinweise und SHA256-Prüfsummen.

## Prüfungen

Lokal werden vollständige TypeScript-/Web-/API-Builds, gemeinsame Kernprüfungen, echte SQLite-Datei-/Transaktionsprüfungen, PostgreSQL-Integration und ein Chromium-Desktopmodusablauf ausgeführt. Der Chromiumlauf ersetzt das Betriebssystem-IPC durch einen Adapter auf eine echte SQLite-Datei und schreibt die Exportdatei tatsächlich; er ist kein Beweis für einen nativen Windows-Speicherdialog.

Drei native Linux-Tests prüfen SQLCipher-Dateiverschlüsselung/richtigen und falschen Schlüssel, Initialisierungssperre und Batch-Rollback. Auf Windows ergänzt die Pipeline einen echten Anmeldeinformationsspeicher-Roundtrip. Danach baut sie NSIS und MSI, installiert die EXE still in ein isoliertes Testverzeichnis und prüft, dass die installierte Anwendung ein responsives Fenster öffnet und geöffnet bleibt. Anschließend prüft Playwright über einen nur im Test aktivierten lokalen WebView2-Debugport den echten nativen Ablauf: Fragebogen anlegen, speichern, freigeben, beantworten und nach Reload auswerten. Der Test nutzt die installierte Anwendung mit echtem Rust-IPC/SQLCipher und keine Speicherattrappe. Manuelle Windows-Dialog-/Barrierefreiheitsabnahme bleibt separat.

Pipeline: `.github/workflows/desktop.yml`. Build und Downloadpakete sind an den im `build-manifest.json` genannten Commit gebunden. Ein GitHub-Release wird erst nach erfolgreichem Build und Installations-/Starttest freigegeben.

## Installation und Grenzen

Siehe [INSTALLATION_WINDOWS.md](INSTALLATION_WINDOWS.md). Windows 10/11 x64 und Microsoft Edge WebView2; bei fehlender Laufzeit ist zur Installation einmalig Internet erforderlich. Die Anwendung selbst funktioniert danach lokal offline.

Die Pakete sind unsigniert und ausdrücklich Vorabversionen. Persönliche lokale Teilnehmerzuordnung, Sync-Pull/Tombstones, automatische Synchronisation und lokale XLSX/PDF-Berichte sind weiterhin offen. Ebenso werden keine vollständige WCAG-/ASVS-/Pflichtenheftabnahme oder allgemeine produktive Datenschutzfreigabe behauptet.

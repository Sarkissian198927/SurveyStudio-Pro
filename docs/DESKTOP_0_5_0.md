# Bedienung, Online-Zugang und Windows-Pakete 0.5.0

Stand: 03.11.2026. Dieser Bericht ergänzt die historische Anforderungsprüfung. Das Pflichtenheft ist weiterhin nicht vollständig erfüllt.

## Korrigierte Bedienung

- Seitennavigation mit scrollbarem Mittelbereich, erreichbarem unteren Menü und echtem mobilen Menü einschließlich Escape/Fokusführung. Geprüft bei 1280×520, 900×600 und 390×720. Alle Menüeinträge haben tatsächliche Ziele und aktive Zustände; Auswertungen ist jetzt eine benutzbare Übersichtsseite.
- „Neue Umfrage“ öffnet einen eigenen Dialog mit Titel und bearbeitbarem Projekt. Doppelte Erstellung wird während der Anfrage verhindert, Fehler werden angezeigt. Die Projektauswahl bleibt nach Navigation und Neustart erhalten.
- Lokale Team-/Mitgliederfunktionen geben keinen falschen Erfolg mehr zurück. Zusammenarbeit verweist zur Webversion. Nicht berechtigte Rollen sehen keine Projekt-Umbenennung.
- Alle 19 Fragewerkzeuge wurden über die Oberfläche angelegt, Pflichtfelder bedient und eine vollständige Vorschau abgeschlossen. Vorschau erzeugt keine Antworten. Verwaltung mit Umbenennung, Kopie, Kommentar/Erledigt, Historie/Restore, Pause/Aktivierung, Archiv/Wiederherstellung und bestätigter Löschung geprüft.
- Veraltete asynchrone Ergebnisse beim Wechsel von Ergebnisversion bzw. öffentlicher Umfrage werden verworfen; öffentliche Routen beginnen einen eigenen Abgabevorgang. Fehler beim Diagrammspeichern sind sichtbar.
- Helle Umfragewerkstatt mit Türkis/Koralle und einem Ablauf „Erstellen – Gestalten – Auswerten“; keine fiktiven Finanzkennzahlen. Eigene Fragebogenhintergründe bleiben gestaltbar.

## Onlinebetrieb

Es existiert noch kein Hosting. Diese Lieferung stellt weder eine öffentliche Domain noch einen laufenden Internetserver bereit. GitHub dient als Downloadort. Die native App prüft eine vom Betreiber eingerichtete HTTPS-Instanz und öffnet deren Login im Systembrowser. HTTP, Zugangsdaten in URLs, Zertifikatsfehler, fehlerhafte/zu große Serverantworten und Weiterleitungen werden zurückgewiesen. Nur erfolgreich geprüfte Ursprungsadressen werden gespeichert.

Das Serverquellpaket enthält PostgreSQL, Anwendung und Caddy für HTTPS, dauerhafte Volumes, zufällige getrennte Schlüssel und ein geschütztes Erstkonto. PostgreSQL/API haben keine öffentlichen Hostports. Erstprovisionierung arbeitet ausschließlich bei leerer Benutzertabelle und verändert bestehende Passwörter nicht. Anleitung: [ONLINE_BEREITSTELLUNG.md](ONLINE_BEREITSTELLUNG.md). SMTP, DNS/ACME und tatsächlicher öffentlicher Betrieb benötigen Betreiberkonfiguration.

## Ausgeführte lokale Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Paket-/API-/Web-Build und Kern-/Vertragstests | 42 Tests bestanden |
| PostgreSQL/HTTP/Export/Browserintegration | 28 Tests bestanden; einschließlich aller 19 Fragetypen, Rechte, Bilder, variable Hintergründe, CSV/XLSX/PDF und Sync |
| Desktopoberfläche über SQLite-IPC-Testadapter | 6 Tests bestanden; echte SQLite-Persistenz, sämtliche Menüs, Erstellen, Verwaltung, 19 Typen, Vorschau, Fehlermeldungen und Exportablauf |
| Native Linux-SQLCipher-/URL-Tests | 5 Tests bestanden |
| Produktionsmodus hinter lokalem TLS-Proxy | Zertifikat tatsächlich geprüft, erstprovisioniertes Konto, Secure/HttpOnly-Sitzung, Anmeldung und persistierte neue Umfrage bestanden |

Die SQLite-IPC-Tests ersetzen keine native Windows-Prüfung. Der TLS-Produktionsintegrationstest verwendet echte API/PostgreSQL und einen lokalen TLS-Proxy; er beweist keine öffentliche DNS-/ACME-Bereitstellung.

## Zusätzliche Server-Containerprüfung

`pnpm run test:online-container` verwendet das zuvor mit `docker build -t surveystudio-pro:local .` gebaute Image. Der Test startet die Online-Compose-Dienste in einem eigenen Netz mit eigenen temporären Volumes, lokaler Caddy-Test-CA und nur an Loopback gebundenem HTTPS-Port 8443. Er prüft Anmeldung, Erstellung und Bestand nach einem App-Neustart. Interner Verkehr zu `app`/`postgres` ist vom externen Proxy ausgenommen; öffentliche HTTPS-Verbindungen behalten die Proxy-/Zertifikatsregeln der Umgebung. Testgeheimnisse werden nur in ignorierten temporären Dateien gehalten und nach Beendigung entfernt. Keine öffentlichen DNS-/ACME- oder Mailzustellungsnachweise.

## Verbindliche Windows-Pipeline vor Downloadfreigabe

`.github/workflows/desktop.yml` verlangt zusätzlich:

1. Native Transaktions-/SQLCipher- und echte Windows-Credential-Store-Tests; HTTPS-URL-Tests.
2. EXE/MSI-Build mit Cargo-Lockfile, WebView2-Bootstrapper, Icons und Lizenzhinweisen.
3. Installation des prüfsummengeprüften 0.4-Setups; verschlüsselte Umfrage anlegen; Upgrade auf 0.5; vorhandene Umfrage wiederfinden.
4. Alle Menüpunkte öffnen; neue Umfrage erstellen, speichern, lokal freigeben, beantworten und nach Neuladen auswerten.
5. CSV über den tatsächlichen Windows-Speicherdialog schreiben und Dateiinhalt prüfen.
6. HTTP ablehnen, falschen TLS-Hostnamen ablehnen, lokal vertrauenswürdiges HTTPS prüfen und tatsächlichen Systembrowseraufruf nachweisen. Dies verwendet einen kurzlebigen lokalen Protokoll-Testserver, keinen öffentlich bereitgestellten Dienst.

Der Manifestwert `installerSmoke: passed` wird erst nach erfolgreichem Durchlauf geschrieben. Veröffentlichung ist an den erfolgreichen Gesamtlauf und dessen Commit gebunden. Den konkreten Lauf weist `build-manifest.json` im GitHub-Release aus. Eine vollständige manuelle Windows-/Screenreader-Abnahme und Codesignierung sind weiterhin offen.

## Verbleibende Produktgrenzen

Lokale persönliche Teilnehmerzuordnung, lokale XLSX/PDF-Berichte, Sync-Pull, automatische Synchronisation, Tombstones und vollständige Mehrgeräte-Konfliktlösung fehlen. Die Webversion hat weitergehende Teilnehmer-/Exportfunktionen. Weitere Pflichtenheftlücken einschließlich Dashboard-Builder, Echtzeit-Coauthoring, umfassender Lokalisierung, SSO und vollständiger WCAG-/Betriebsabnahme stehen in [ANFORDERUNGSPRUEFUNG.md](ANFORDERUNGSPRUEFUNG.md). Kein vollständiges 1.0-Erfüllungsversprechen.

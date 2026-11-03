# SurveyStudio Pro 0.4.0 – Windows x64

Vorabversion für Windows 10/11 mit 64 Bit. Das Paket ist nicht digital signiert. Windows kann deshalb einen Hinweis auf einen unbekannten Herausgeber anzeigen. Die Dateien werden direkt aus dem im Buildmanifest angegebenen GitHub-Commit gebaut; SHA256-Prüfsummen liegen bei.

## Installieren

Für die normale Installation die Datei mit der Endung `-setup.exe` herunterladen und starten. Sie installiert für den aktuellen Windows-Benutzer und benötigt dafür keine Administratorinstallation. Das MSI-Paket ist die alternative Windows-Installer-Verteilung. Beide Pakete enthalten dieselbe Anwendung; nur eines installieren.

Microsoft Edge WebView2 wird benötigt. Auf aktuellen Windows-Systemen ist es üblicherweise vorhanden. Fehlt es, kann das Setup es nachladen; dafür ist einmalig Internet erforderlich. Die installierte Anwendung benötigt für lokale Umfragen anschließend keinen Server und kein Benutzerkonto.

## Erster Fragebogen

1. SurveyStudio Pro starten, einen Umfragetitel eingeben und „Erstellen“ wählen.
2. Fragen und mehrere Seiten anlegen; unter „Design“ Hintergrundfarbe, Verlauf, Muster oder ein Bild wählen. Speichern.
3. „Lokal freigeben“ wählen und den lokalen Fragebogen öffnen. Antworten werden verschlüsselt auf diesem Gerät gespeichert.
4. In der Übersicht die Auswertung öffnen. Eine veröffentlichte Version auswählen und CSV oder ein Diagramm als PNG/SVG über den Speicherdialog sichern.

Eine lokale Freigabe ist kein öffentlicher Internetlink. Für andere Geräte eine eigene Webinstanz betreiben, dort einen Gerätezugang erzeugen, in der Desktop-App manuell synchronisieren und anschließend die Webpublikation aktivieren.

## Daten und Grenzen

Die Datenbank ist mit SQLCipher verschlüsselt; ihr zufälliger Schlüssel liegt im Windows-Anmeldeinformationsspeicher. Datenbankdatei und Schlüssel gehören zusammen. Die Datei allein genügt nicht zur Wiederherstellung auf einem anderen Gerät. Wichtige Ergebnisse zusätzlich exportieren; vor Deinstallation oder Wechsel des Windows-Profils eine vollständige Sicherungsstrategie festlegen.

Diese Vorabversion unterstützt lokale anonyme Umfragen und manuellen Sync zum Server. Persönliche lokale Teilnehmerzuordnungen, Sync-Pull, automatische Synchronisation und lokale XLSX/PDF-Berichte fehlen noch. Lokales Löschen löscht bereits übertragene Serverdaten nicht. Das gesamte Pflichtenheft ist noch nicht vollständig erfüllt; siehe Anforderungsprüfung im Repository.

## Prüfsumme kontrollieren

In PowerShell `Get-FileHash .\DATEINAME-setup.exe -Algorithm SHA256` ausführen und den Wert mit `SHA256SUMS.txt` desselben Releases vergleichen. Nur Dateien aus dem angegebenen GitHub-Release verwenden.

# Anforderungsprüfung – SurveyStudio Pro

Stand: 03.11.2026. Quelle: `SurveyStudio_Pro_Pflichtenheft_v1_0.docx`, Version 1.0. Der aktuelle Nutzerauftrag erweitert die ursprünglich auf I-01 begrenzte Arbeit auf Fehlerbehebung und Integration der Funktionen. Der folgende Abgleich dokumentiert den Ausgangsstand. Der anschließende Auftrag erlaubt ausdrücklich eine GitHub-Desktopbereitstellung; deren historische Änderungen und Prüfungen stehen in [DESKTOP_0_4_0.md](DESKTOP_0_4_0.md). Die erneute Bedienungsprüfung und Version 0.5 sind in [DESKTOP_0_5_0.md](DESKTOP_0_5_0.md) dokumentiert; dessen Windows-Nachweis steht im jeweiligen Release-Manifest.

**Das gesamte Pflichtenheft ist noch nicht erfüllt.** Die Tabellen unterscheiden vorhandene Funktion, technischen Nachweis und verbleibende Implementierung/Abnahme. Implementiert bedeutet keine Produktiv-, Datenschutz- oder Sicherheitsfreigabe. Alle Tests verwenden synthetische Daten.

## Funktionale Anforderungen

| ID / Priorität | Umsetzung und Nachweis | Verbleibende Lücke |
|---|---|---|
| F-001 Identität / P0 | Registrierung, Login/Logout, widerrufbare Sitzungen, einmalige Reset-/Verifikationstoken; echte HTTP-Tests | Vollständiger Einladungs-/Annahmeprozess neuer Teamkonten; realer Mailtransport unkonfiguriert |
| F-002 Organisation / P0 | Mandanten, verschachtelte Projektordner, Mitgliedschaften, Rollen und Mandanten-FKs; Paralleltest für letzten Owner | Vollständige fachliche Organisationsabnahme |
| F-003 Umfragen / P0 | Erstellen, umbenennen, duplizieren, archivieren/wiederherstellen, persistente Entwürfe/Historie; HTTP-/SQLite-Tests | Durchgehende manuelle Produktabnahme |
| F-004 Designer / P0 | Drei Spalten, 19 Fragetypen, Hinzufügen/Kopieren/Umordnen/Entfernen, Tastaturaktionen und Seitenzuordnung | Vollständiger Tastatur-/Screenreader-Test |
| F-005 Kernfragen / P0 | Alle neun Typen, gemeinsamer Validator in Renderer/API/lokalem Store; Veröffentlichung und Abgabe geprüft | Breitere Browsermatrix |
| F-006 Gestaltung / P0 | Farben, Schriften, Fett/Kursiv, Logo, Header/Footer, Bild/Farbe/Verlauf/Muster, Overlay/Papierdeckkraft; identische Hintergrundfunktion in Vorschau und Teilnahme, Chromium-Vergleich nach Speichern | Vollständiger Rich-Text-AST/formatierbare Überschriften und manuelle Layoutabnahme |
| F-007 Seiten / P0 | Begrüßung/Abschluss, mehrere Seiten, Fortschritt, Navigation und stabile Reihenfolge | Freie Rich-Text-Formatierung nur in reduziertem Umfang |
| F-008 Versionen / P0 | Unveränderliche Snapshots mit DB-Trigger, Versions-FK der Antworten; Wiederveröffentlichung/Änderungsverbot geprüft | 50 historische Abgaben mit geänderter Frage/Option und korrekter alter Auswertung geprüft |
| F-009 Publikation / P0 | Getrennte Links, PNG/SVG-QR, Zeitfenster, Pause/Schließen und Antwortlimit; PNG tatsächlich decodiert | Kameratest auf echten Mobilgeräten |
| F-010 Antwortsystem / P0 | 422 bei ungültiger Abgabe, gemeinsame Validierung, Transaktion, kanonische Idempotenz und Bestätigung; Parallel-Retries/Browserabgabe geprüft | Prozess-/Hostausfall nach ACK nicht simuliert |
| F-011 Basisauswertung / P0 | Versionen, absolut/relativ, Tabellen, Balken/Kreis/Donut, Tagesübersicht und Fragefilter; SQL-Aggregation ohne Rohdaten im Browser | Zeitreihe derzeit Tabelle; erweiterte Filter/Diagramme eingeschränkt |
| F-012 Export / P0 | Ownergeschützte asynchrone CSV/XLSX/PDF-Jobs; echte Datei-/Unicode-/PDF-Textextraktion einschließlich CJK | Vollständige lokale Desktop-XLSX/PDF-Ausgabe; großer XLSX separat offen, CSV mit 100.100 Sitzungen geprüft |
| F-013 Datenschutzbasis / P0 | Drei Privacy-Modi, verschlüsselte getrennte Identitäten, Einladungspflicht für persönliche Modi, DB-Sperre gegen anonyme Zuordnung, Frist und Datenschutzhinweis; produktive Freigabe verlangt Angaben; Bestätigung revisionsgebunden | Freitext/Quasiidentifikatoren bleiben Risiko; vollständige Randdaten-/Backup-Policy fehlt |
| F-014 Rechte / P0 | Owner/Editor/Viewer/Analyst/Gast; Rohdaten, Teilnehmer und Freigaben nur Owner; Fremdzugriffe verweigert, Entzug wirkt bei nächster Anfrage | Vollständige ASVS-/BOLA-Gesamtabnahme |
| F-015 Ergebnisse teilen / P0 | Separater zufälliger Ergebnislink/QR, Ablauf/Widerruf, eingefrorene Aggregate und Gruppensuppression; kein öffentlicher Rohdatenzugriff | Allgemeine Anonymitätsgarantie und Kombination mehrerer gezielter Freigaben nicht nachgewiesen |
| F-016 Assets / P0 | Magic Bytes, Rasterdecodierung, Pixel-/Dateilimit, Metadatenentfernung/Neukodierung; Zugriff bis aktiver Veröffentlichung privat; Eigentum/Löschung geprüft | Allgemeine AV-/Dokumenten-Sanitization; Antwortdateien/Inline-Bildoptionen nutzen nicht dieselbe Rasterpipeline; Lebenszyklus alter Assets offen |
| F-017 Autosave / P0 | Revision-CAS, Fehler-/Konfliktanzeige; Wiederholschleife nach 409 und veraltete asynchrone Ergebnisse verhindert; API-Konflikttest | Vollständige Zweifenster-UI-Abnahme |
| F-018 Desktop / P1 | Tauri, echter lokaler Store, Offline-Editor/Abgabe/CSV, SQLCipher mit Schlüsselbund; SQLite-Neustart- und native Verschlüsselungs-/Sperrtests | Windows-Installer/GUI und echter Schlüsselbundanbieter nicht ausgeführt; persönliche lokale Modi und XLSX/PDF fehlen |
| F-019 Sync / P1 | Manueller HTTPS-Push, widerrufbare Gerätetoken, Outbox, Payload-Hash/Idempotenz und Konflikte; echte SQLite→PostgreSQL-Prüfung | Pull, automatische Planung, Tombstones und vollständige Mehrgeräte-Konfliktlösung fehlen |
| F-020 Teilnehmer / P1 | CSV/XLSX mit Vorschau/Duplikaten, verschlüsselte Liste, persönliche Einladungscodes, Rechteprüfung | Vollständige Status-/Anmeldelisten und Erinnerungssteuerung fehlen |
| F-021 E-Mail / P1 | Verschlüsselte Queue, STARTTLS/SMTP-TLS, fester Betreiberabsender, Status/Retry, Einladung/Reset/Verifikation; Entwicklungspostfach in Produktion gesperrt | Echter TLS-Testversand, organisationsbezogene verifizierte Absender, OAuth/Bounces/Bestätigungs-/Reminderplanung fehlen |
| F-022 Zusammenarbeit / P1 | Projektfreigabe, Kommentare mit Erledigtstatus, Historie/Restore und Revisionsschutz | Zugewiesene Aufgaben, Bearbeitungssperren und parallele UI-Abnahme fehlen |
| F-023 Erweiterte Fragen / P1 | Likert, zwei Matrixarten, Sterne, Slider, Ranking, NPS, Bildauswahl, Datei und Termin; alle 19 Typen durch echte API-Abgabe und Validierung | Dedizierte visuelle und Exportabnahme jedes erweiterten Typs offen |
| F-024 Logik / P1 | Sichtbarkeit, bedingte Pflicht, UND/ODER, Vorwärtssprünge bis Abschluss, Zyklus-/Referenzprüfung; versteckte Pflichtfragen blockieren nicht | Komplexe interaktive Ablaufabnahme über mehrere Geräte |
| F-025 Reporting / P1 | Farben, Frage-/Versionsauswahl, SVG/PNG der Diagramme und PDF-Bericht; serverseitige Rechte | Persistierbarer Dashboard-Builder, kombinierbare Filter und visuelle Exportabnahme fehlen |
| F-026 Rechteverwaltung / P1 | Analyst/Gast, Mitgliederverwaltung, Auditansicht und DB-geschützte Ereignisse; Entzug geprüft | Benutzerdefinierte Rechte/Betriebsrollen fehlen |
| F-027 Anonymisierung / P1 | Listen entkoppeln, Mindestgruppe ab fünf, ganze Frage bei kleinen Zellen unterdrückt; keine öffentlichen Freitexte/Zeitfilter; eingefrorene Freigaben | Vollständiges Risikomodell für kombinierte Snapshots, statistische Rückschlüsse und Freitexte fehlt |
| F-028 Datenschutzrechte / P1 | Berechtigte Liste/Suche, Berichtigung, Personenexport, bestätigte Gesamtlöschung; Antworten/Export/Share-Bereinigung, Antwort-Retention und Audit geprüft | Gesamte Identitäts-/Mail-/Asset-/Backup-Retention unvollständig; anonyme Freitextpersonen nicht automatisch auffindbar |
| F-029 Backup / P1 | AES-GCM-Backup, Restore nur in neue DB, Migrationen und echter Restore-/Manipulationstest | Produktions-RPO/RTO, große Daten, Asset-/Schlüsselsicherung und Turnus offen |
| F-030 Barrierefreiheit / P1 | Labels, Fieldsets/Legenden, Fehlerfokus, Tastaturaktionen, Tabellen und responsive Chromium-Tests | WCAG 2.2 AA mit Screenreader/Kontrasten insgesamt offen |
| F-031 Audit / P1 | Strukturierte Projekt-/Identitäts-/Datenschutzereignisse, Owneransicht und DB-Trigger gegen Update/Delete | Nicht jede Mutation abgedeckt; privilegierte Administration/Archivierung offen |
| F-032 Sprachen / P1 | Deutsche Oberfläche, Unicode-Export/Persistenz | Zentrale Übersetzungsschlüssel, systematische Formate/Locale-Fallback fehlen |
| F-033 Statistik / P2 | Mittelwert, Median, Standardabweichung, NPS, Matrixzählung und mittlere Rangposition | Kreuztabellen, Boxplot und Heatmap fehlen |
| F-034 Coauthoring / P2 | Revision erkennt Konflikte | Live-Präsenz und Echtzeitbearbeitung fehlen |
| F-035 Anmeldung Plus / P2 | Terminwahl und allgemeines Antwortlimit vorhanden | Slotkapazität, Warteliste, Storno/Umbuchung und Transaktionsmails fehlen |
| F-036 Dynamik Plus / P2 | Bedingte Anzeige und Seitenführung vorhanden | Berechnungen, Piping, reproduzierbare Randomisierung, Budget-/Wiederholungsfragen fehlen |
| F-037 Integrationen / P2 | Gerätezugang ausschließlich für Sync, CSV/XLSX-Ausgabe | Webhooks, generische API-Keys/Scopes, BI und Formdefinitionsimport fehlen |
| F-038 Versionen Plus / P2 | Historie/Restore und Versionsauswertung vorhanden | Versionsvergleich/Migrationsmapping fehlen |
| F-039 KI / P3 | Offen, optional | Keine KI-Anbindung oder externe Datenübertragung implementiert |
| F-040 Enterprise / P3 | Offen, optional | SSO/SCIM, Mandantenrichtlinien und Custom Domains fehlen |

## Nichtfunktionale Anforderungen

| ID | Nachweis und Grenze |
|---|---|
| NFR-01 | Synthetischer Lastlauf: 30 Fragen, 100 gleichzeitige Abgaben, p95 627 ms auf 4 CPU/32 GiB; kein Nachweis auf 8-GiB-Referenzmaschine. Details im Testbericht. |
| NFR-02 | Kein definierter 4G-/Lighthouse-LCP-Lauf. |
| NFR-03 | 100.000 vollständige Sitzungen/3.000.000 Antworten angelegt und ausgewertet; Browser erhält Aggregate. |
| NFR-04 | Kein gemessener produktiver SLA-/Verfügbarkeitszeitraum. |
| NFR-05 | Lokaler verschlüsselter Restore getestet; Produktions-RPO ≤24 h/RTO ≤4 h und Turnus offen. |
| NFR-06 | Parallele Retries idempotent; SQL-Transaktion und ACK nach Commit. Prozess-/Hostausfalltest offen. |
| NFR-07 | Auth/CSRF/Mandanten/Rollen/Datei/Token geprüft, produktive Startprüfungen und Abhängigkeitsaudit; keine ASVS-5.0-L2-/Pentest-Gesamtabnahme. |
| NFR-08 | Semantik/einzelne Browserabläufe geprüft, manuelle WCAG-Gesamtabnahme offen. |
| NFR-09 | Chromium Desktop/Mobil geprüft; Firefox/Safari/Edge, 320-px-Gesamtlauf und Windows-GUI offen. |
| NFR-10 | Strikte TypeScript-Builds, API-/Schema-/SQLite-Verträge, Lockfiles/additive Migrationen; Shared-Kern teilweise CJS, ergänzte OpenAPI-Routen nicht vollständig DTO-typisiert. |
| NFR-11 | DB-Health, Request-ID, Fehlerformat, Audit/Jobstatus; vollständige Metriken/Alerts/Telemetrieprüfung fehlen. |
| NFR-12 | Asynchrone Exporte in 500er-Blöcken; CSV mit 100.100 Sitzungen/277,9 MB in rund 14 s erzeugt und vollständig geprüft. Großer XLSX und verbindliche Laufzeitgrenze offen. |
| NFR-13 | Docker-Appbuild/Startprüfung, Cargo-Lockfile/native SQLCipher-Tests und Windows-Buildworkflow; Windows-Installer nicht gebaut/ausgeführt, Gesamtrollback offen. |
| NFR-14 | Deutsche UI/Unicode einschließlich CJK geprüft; Übersetzungsschlüssel und vollständige Locale-Formatierung offen. |

## Abnahmefälle

| Fall | Nachweis / ausstehende Abnahme |
|---|---|
| AT-01 | Zehn Fragen nach Logout/erneutem Login vollständig identisch aus PostgreSQL geladen. |
| AT-02 | Gespeicherter Gradient in Designer/Mobilvorschau/öffentlichem Renderer verglichen; Raster-/Logopipeline separat geprüft. Vollständiger Designvergleich offen. |
| AT-03 | 422 ohne gespeicherte Sitzung; Browser zeigt Pflichtfehler. Screenreader-Abnahme offen. |
| AT-04 | PNG-QR decodiert, passende URL/öffentliche Browserabgabe geprüft; physischer Scan offen. |
| AT-05 | 50 historische Abgaben bleiben nach Frage-/Optionsänderung am alten Snapshot; alte Beschriftungen/Zählwerte korrekt, neue Version ohne alte Antworten. |
| AT-06 | Acht parallele identische Abgaben und Sync-Retries ohne Duplikat; gleiche ID mit anderer Payload ergibt Konflikt. |
| AT-07 | Fremde Projekte/Teilnehmer/Exportjobs und Analyst-Rohdatenzugriff tatsächlich verweigert. |
| AT-08 | Separater eingefrorener Ergebnislink und Widerruf/404 geprüft. |
| AT-09 | Ganze Fragen bei kleinen Zellen unterdrückt, keine öffentlichen Rohdaten/Filter; Rekonstruktion über mehrere Freigaben nicht umfassend abgenommen. |
| AT-10 | Identische Links für anonyme Einladungsliste, keine individuelle Einladung erzeugt; DB verbietet Zuordnung. Vollständige Betriebslog-/Zeitkorrelationsprüfung offen. |
| AT-11 | Queue/Status/Transportkonfiguration vorhanden; kein echter verifizierter SMTP-Testversand. |
| AT-12 | Veraltete Revision ergibt 409 ohne Überschreiben; Zweifenster-Konfliktdialog offen. |
| AT-13 | Echte SQLite-Neustart-/CSV- und native SQLCipher-Tests; Windows-Offline-GUI-Ablauf offen. |
| AT-14 | Echte Outbox→PostgreSQL mit Retry/ACK, Konflikt/Tokenwiderruf; Pull/Tombstones fehlen. |
| AT-15 | Antwort-Retention und persönliche Löschung inklusive Share-/Exportbereinigung geprüft; gesamte Asset-/Identitäts-/Backup-Policy offen. |
| AT-16 | Unicode-PDF und SVG/PNG vorhanden; visuelle Gleichheits-/Druckabnahme offen. |
| AT-17 | Labels/Fieldsets/Fokus und Browserabgabe; manueller Tastatur-/Screenreader-Gesamtlauf offen. |
| AT-18 | Verschlüsselter Restore mit 50 Unicode-Antworten, Versionshash/Referenzen, Wiederholungsmigration und FK-Prüfung bestanden; vollständiger Asset-/Schlüsselvergleich offen. |

Ausgeführte Befehle und Resultate: [TESTBERICHT.md](TESTBERICHT.md). Betrieb/Schlüssel: [BETRIEB.md](BETRIEB.md). Diese Lieferung bleibt ein Entwurf für technische Prüfung.

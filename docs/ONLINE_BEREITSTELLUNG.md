# Online-Zugang und eigener Server

Die Desktop-App allein erzeugt keine öffentlich erreichbare Webadresse. Eine GitHub-Release-Seite ist ein Downloadort und betreibt keine API oder Datenbank. Ohne vorhandenes Hosting ist noch keine öffentliche SurveyStudio-Webversion eingerichtet.

## Was benötigt wird

Ein eigener Linux-Server/VPS mit Docker Engine und Compose, eine Domain/Subdomain und eingehende Ports 80/443. Die Domain muss per A/AAAA-DNS-Eintrag auf diesen Server zeigen. Hosting und Domain müssen vom Betreiber bereitgestellt werden; diese Anleitung bestellt keine kostenpflichtigen Dienste und verändert keine fremden Server.

## Starten

Quellpaket dieser Version herunterladen und auf dem Server entpacken. In dessen Verzeichnis zunächst die geschützte Konfiguration erzeugen, beispielsweise mit einem kurzlebigen Node-Container:

```sh
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/setup" -w /setup node:22-bookworm-slim node scripts/setup-online.cjs --domain umfragen.deine-domain.de --email admin@deine-domain.de
docker compose --env-file .env.server -f docker-compose.online.yml up -d --build
```

Beispiel-Domain und E-Mail durch eigene Angaben ersetzen. `.env.server` wird mit getrennten Zufallsschlüsseln und einem zufälligen ersten Administratorpasswort angelegt. Sie darf weder veröffentlicht noch in Git eingecheckt werden. Bestehende Konfigurationen werden nicht überschrieben.

Caddy kümmert sich um HTTPS-Zertifikate, sobald DNS und Erreichbarkeit stimmen. PostgreSQL und API erhalten keine öffentlichen Hostports. Migrationen werden automatisch angewandt. Nur bei einer vollständig leeren Benutzertabelle wird das ausdrücklich konfigurierte erste Administratorkonto angelegt; bestehende Konten werden weder zurückgesetzt noch ersetzt. Dieses Erstkonto wird durch den Serverbetreiber provisioniert und ist für die erste Anmeldung freigeschaltet.

Danach `https://DEINE-DOMAIN/login` öffnen. Die Administrator-E-Mail und das geschützte Erstpasswort aus `.env.server` verwenden. Unter `/api/v1/health` müssen `status: ok` und `service: surveystudio-pro` erscheinen. Erst nach dieser Prüfung ist eine öffentliche Instanz tatsächlich verfügbar.

## Desktop verbinden

In der Desktop-App „Online-Zugang“ öffnen, die eigene HTTPS-Adresse eintragen und „Verbindung prüfen und speichern“ wählen. „Online-Anmeldung öffnen“ öffnet die Webversion im Standardbrowser. Im Browser können gemeinsame Projekte, Teilnehmer, öffentliche Links und Online-Exporte genutzt werden. Für lokale Übertragung im Webbereich „Synchronisation“ einen Gerätezugang erzeugen; anschließend in der Desktop-App das Zielprojekt und den Gerätezugang eintragen.

Der derzeitige Sync überträgt lokale Änderungen zum Server. Rückübertragung/automatischer Mehrgeräteabgleich sind noch nicht vorhanden. Lokales Löschen entfernt keine bereits auf dem Server gespeicherten Antworten.

## Mail, Sicherung und Betrieb

Für E-Mail-Verifikation neuer öffentlicher Konten und Passwort-Reset ist ein autorisierter SMTP/TLS-Absender erforderlich. Dazu die im Compose enthaltenen SMTP-Variablen sicher konfigurieren. Ohne diesen Dienst ist externer Mailversand nicht eingerichtet; das provisionierte Erstkonto ermöglicht trotzdem die Administration und Erstellung von Umfragen. Ein bloß gefüllter Mailjob ist kein Versandnachweis.

PostgreSQL, Bilder, Exporte und Caddy-Zertifikate verwenden dauerhafte Volumes. Datenbank, Assetvolume und `DATA_ENCRYPTION_KEY` müssen gemeinsam sicher gesichert werden. Der enthaltene lokale Entwicklungs-Backuphelper ersetzt keinen Produktionsbackupplan. Kein `docker compose down -v` verwenden, wenn Daten erhalten bleiben sollen.

Interner Containerverkehr zu `app` und `postgres` ist in Caddys `NO_PROXY`/`no_proxy` eingetragen. Ein vorhandener externer Proxy bleibt für externe Verbindungen nutzbar.

Der direkte Dienstzugriff ist absichtlich intern. `TRUST_PROXY_HOPS=1` ist nur in dieser abgeschlossenen Konfiguration mit Caddy vor der API vorgesehen. Wer die API zusätzlich direkt ins Internet veröffentlicht, muss die Proxy-/Rate-Limit-Konfiguration neu prüfen.

Die HTTP-/Docker-/lokalen TLS-Prüfungen im Projekt ersetzen keinen tatsächlichen DNS-/ACME-/Hostingtest auf einem noch nicht vorhandenen Server. Ein dauerhafter Online-Zugang kann erst mit gewähltem Hosting und Domain live abgenommen werden.

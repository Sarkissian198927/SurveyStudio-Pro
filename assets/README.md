# Eingebettete PDF-Schriften

Die Dateien werden lokal für Unicode-PDFs eingebettet; beim Berichtabruf erfolgt kein externer Fontdownload.

- `DejaVuSans.ttf`: DejaVu Sans, Projekt https://dejavu-fonts.github.io/ . Lizenz: `DejaVu-LICENSE.txt`. SHA256: `57f73e11f51999432bf7ab22ce55b6f945d5eca1bf824404cfa9ec2e3718c84e`.
- `NotoSansCJKsc-Regular.otf`: Noto Sans CJK SC, offizielles Projekt https://github.com/notofonts/noto-cjk (Sans/OTF/SimplifiedChinese). Lizenz: `NotoCJK-LICENSE.txt`. SHA256: `2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b`.

Beide Lizenztexte werden mit dem Quellcode/Image ausgeliefert. Die PDF-Ausgabe prüft derzeit CJK-Zeichen zur Fontauswahl; ein vollständiges mehrsprachiges Font-Fallback-System steht noch aus.

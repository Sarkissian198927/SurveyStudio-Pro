# ExcelJS-Kompatibilitätspatch

`exceljs@4.4.0.patch` ergänzt genau die fehlende Rückgabe `return destination` in `StreamBuf.pipe()`. Nach Node-Stream-Vertrag gibt `pipe()` sein Ziel zurück. Archiver 7 verwendet diese Rückgabe beim Normalisieren der Eingabe; ohne Patch scheitert der XLSX-Streamingexport mit `INPUTSTEAMBUFFERREQUIRED`.

Der Patch ist unter `pnpm.patchedDependencies` registriert und sein Hash im Lockfile enthalten. Keine manuelle Änderung in `node_modules` ist erforderlich. Die gezielten Versionsanpassungen in `pnpm.overrides` schließen die beim Produktionsaudit gefundenen Multer-/UUID-/Minimatch-Befunde. Tests prüfen ZIP-Globbing, Unicode, Streaming-XLSX, Import sowie reale API-Exporte. Änderungen an ExcelJS/Archiver erfordern erneut diese Prüfungen; der Patch darf nach einer upstreamseitigen Korrektur entfernt werden.

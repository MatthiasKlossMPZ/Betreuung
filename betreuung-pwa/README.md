# Betreuung – Wer ist noch da?

Kleine Progressive Web App für die Nachmittagsbetreuung / den Hort:
Liste der betreuungspflichtigen Kinder, Status pro Tag (noch da, abgeholt, krank, nicht da, alleine gegangen), Wochenraster und Zähler bis zum letzten Kind.

## Was die App kann

- Schülerliste mit Klasse, Betreuungspflicht, Alleingeher-Vermerk, Abholberechtigten und Notizen
- Tagesansicht mit großem **Noch-da**-Zähler
- Ein-Tipp-Status: Abgeholt (mit Uhrzeit), Krank, Nicht da, Alleine gegangen
- Wochenansicht Mo–Fr, Status per Tipp durchschalten
- Filter „Noch da / Alle / Erledigt“ und Namenssuche
- Schülerliste per CSV importieren (Excel/LibreOffice), Vorlage und Listenexport
- Backup als JSON, Tagesliste als CSV
- Läuft offline, sobald sie einmal geladen und idealerweise installiert ist
- Daten bleiben **auf dem Gerät** (kein Server, kein Account)

## Start

Die Dateien in diesem Ordner auf einen Webspace mit **HTTPS** legen (Schulserver, GitHub Pages, IONOS, Nextcloud öffentlich, …). Dann die URL im Tablet-Browser öffnen und „Zum Home-Bildschirm / App installieren“ wählen.

Lokal zum Ausprobieren:

```bash
cd betreuung-pwa
python3 -m http.server 8080
```

Browser: http://localhost:8080

Ohne Webserver funktioniert die Oberfläche auch, wenn man `index.html` direkt öffnet – Installation und Service Worker brauchen aber http(s).

## Alltag

1. Unter **Schüler** die Klasse anlegen, Beispieldaten laden **oder CSV importieren**.
2. Unter **Heute** die Kinder austragen, die abgeholt oder krank sind.
3. Oben bleibt sichtbar, wie viele noch da sind.
4. **Woche** eignet sich für den Blick über mehrere Tage.
5. Unter **Mehr** Backup sichern, besonders vor den Ferien oder beim Gerätewechsel.

## Was bewusst fehlt (erste Version)

- Kein Eltern-Login, keine Push-Nachricht an Eltern
- Keine Echtzeit-Synchronisation zwischen mehreren Tablets (Lösung: JSON-Backup oder später ein kleines Backend)
- Keine Fotos, keine QR-/Chip-Erfassung
- Keine rechtssichere Dokumentation im Sinne einer Schulverwaltungssoftware

Für eine ganze Schule mit Eltern-App sind Systeme wie IServ-Ganztag, HortPRO, LITTLE BIRD, Stay Informed oder Ganztagsplaner gedacht. Diese PWA ist die leichte Alternative für ein Team, das schnell den Überblick braucht.

## Datenschutz

Es werden keine Daten nach außen gesendet. Trotzdem: Tablets mit Code sperren, Backups nicht unverschlüsselt per Mail schicken, keine unnötigen Gesundheitsdaten in die Notizfelder schreiben.

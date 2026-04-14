<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Wide PDF

Wide PDF erweitert PDF-Seiten rechts um Notizfläche und unterstützt eine temporäre Session-Inbox für Apple-Kurzbefehle.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Optional: Set `VITE_SESSION_API_BASE_URL` in `.env.local`, wenn die Inbox gegen einen Cloudflare Worker laufen soll.
3. Run the app:
   `npm run dev`

## Inbox Backend

Der Inbox-Upload läuft über einen Cloudflare Worker im Ordner `worker/`.

1. `cd worker`
2. `npm install`
3. In `wrangler.toml` die KV Namespace IDs einsetzen
4. `cp .dev.vars.example .dev.vars` und Werte ausfüllen
5. `npm run dev` oder `npm run deploy`

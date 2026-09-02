# Phenomatch cloud workspace

This GitHub repo is the **cloud** half of Phenomatch. Camera, overlay, audio, native Mac, installer, and simulator stay on the local Mac agent.

## Run

```bash
npm install
npm run cloud -- --host 0.0.0.0 --port 5173
```

- Web UI: http://localhost:5173/
- Matching API: http://localhost:8787/api/health

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness + GCP stub status |
| GET | `/api/gcp` | `devo-holding` project stub |
| GET | `/api/filters` | Virginity, genealogy, age options |
| GET | `/api/phenotype/me` | Current cluster profile |
| POST | `/api/phenotype/scan` | Simulated optical scan (no camera) |
| POST | `/api/matches` | Ranked cluster matches for filters |
| POST | `/api/umingle/join` | Anonymous guest join (no account) |
| GET | `/api/umingle/matches` | Ranked Umingle guests for a guest id |
| POST | `/api/umingle/chat` | Open a phenotype chat room |
| GET | `/api/umingle/chat/:id` | Chat messages |
| POST | `/api/umingle/chat/:id/messages` | Send a chat message |

Match ranking combines visual traits, tribe, and genealogy cluster. Cluster Match filters are virginity, genealogy minimum, and age range. Umingle skips accounts and fertility filters: guests match by phenotype and chat.

## GCP

Project `devo-holding`. See [`gcp/README.md`](../gcp/README.md). The API uses an in-memory catalog until Firestore is wired.

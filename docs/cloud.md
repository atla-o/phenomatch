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
| POST | `/api/phenotype/gene` | Link a genealogy / gene file to the phenotype |
| POST | `/api/matches` | Ranked data matches for filters |
| POST | `/api/umingle/join` | Join the Anon lobby (heartbeat + live peers only) |
| POST | `/api/umingle/live` | Seek a similar live guest (50%+). Returns `waiting` when alone |
| POST | `/api/umingle/heartbeat` | Presence + assigned room |
| POST | `/api/umingle/leave` | Leave a room or go offline |
| POST | `/api/umingle/signal` | WebRTC offer / answer / ICE (atomic append) |
| GET | `/api/ice` | STUN/TURN list for Anon WebRTC |
| GET | `/api/umingle/chat/:id` | Chat messages + signaling payloads |
| GET | `/api/umingle/chat/:id/signals` | Call id + full `signals` for the peer |
| POST | `/api/umingle/chat/:id/messages` | Send a chat message |
| POST | `/api/umingle/chat/:id/restart` | Clear signals and bump `callId` |

Match ranking combines visual traits, tribe, and genealogy. Match uses Data and Anon toolbars at the top of the section. Data filters are virginity, genealogy minimum, and age range (collapsible; swipe sits above them). Anon is live WebRTC video + text with someone at 50%+ phenotype similarity who is actually online. Catalog seeds are Data-only. `/api/umingle/*` still powers that pane.

Anon WebRTC uses extra STUN plus public Open Relay / Metered TURN by default (`GET /api/ice`). Concurrent offer/answer/ICE posts append atomically (Firestore transaction in `devo-holding`, locked append in memory). If ICE does not reach `connected` in about 10s the offerer renegotiates; after about 18s the UI shows **Couldn't connect video — retry**, which bumps `callId` and clears signals. Override ICE with `PHENOMATCH_ICE_SERVERS` (JSON) or `PHENOMATCH_TURN_URLS` + `PHENOMATCH_TURN_USERNAME` + `PHENOMATCH_TURN_CREDENTIAL` — no Devo secrets required for the public defaults.

## Anon video filter

Anon samples local and remote camera frames with the Antiporn skin / explicit box detector (`shared/antiporn-detector.mjs`, ported from `atla-o/antiporn` `extension/detector.js`). Squares cover flagged regions; a **Filtered** wall can hide the feed when the heuristic fires. Default on, user-toggleable. This is not a medical or legal classifier.

Future upgrade path (not required to ship): LSPD, C4Censor, NSFW Data Source URLs, Falconsai/NSFWJS. Do not download those corpora into this repo.

## Production

Public host: https://phenomatch.devoutshaman.com on GCP Cloud Run (`phenomatch-web`, project `devo-holding`, region `us-west1`). Cloudflare is DNS-only (grey cloud to `ghs.googlehosted.com`) — no Workers.

**Push or merge to `main` updates this host.** There is no separate beta host. GitHub Actions (`.github/workflows/deploy-cloudrun.yml`) is the deploy path; cloud agents must not deploy from this checkout.

```bash
gcloud run deploy phenomatch-web --source . --project=devo-holding --region=us-west1
```

Do not pass `--allow-unauthenticated` (org policy blocks `allUsers`). Public access uses invoker IAM disabled (`run.googleapis.com/invoker-iam-disabled=true` / `--invoker-iam-check=disabled`), already true on the live service. See [README.md](../README.md) and [gcp/README.md](../gcp/README.md).

The container listens on `0.0.0.0:$PORT` and serves the built UI plus `/api`. Production persists profiles, match candidates, match queries, gene metadata, and Umingle guests/rooms in Firestore (`devo-holding`). The memory catalog is local/dev only. See the env table in [README.md](../README.md) and IAM in [gcp/README.md](../gcp/README.md).

## GCP

Project `devo-holding`. See [`gcp/README.md`](../gcp/README.md). Cloud Run uses Firestore; local cloud/dev uses memory unless `PHENOMATCH_STORE=firestore`.

# Phenomatch

A Devo product. Matches people by phenotype. Revenue toward Devo's fertility program.

This GitHub repo is the **cloud workspace**: web app, matching API, GCP stubs, GitHub, docs.

Camera, overlay, audio, native Mac, installer, and simulator stay on the local Mac agent. Do not run this product cloud-only.

## Cloud

```bash
npm install
npm run cloud -- --host 0.0.0.0 --port 5173
```

Black-and-white Pheno / Match UI. Match categories: data (swipe, collapsible virginity / genealogy / age filters) and anon. Anon match is a live video chat with a similar phenotype (50%+); text is secondary and Skip finds the next peer. Pheno can upload a gene file to link genealogy.

See [docs/cloud.md](docs/cloud.md) and [gcp/README.md](gcp/README.md).

## Production (Cloud Run)

Public host: [https://phenomatch.devoutshaman.com](https://phenomatch.devoutshaman.com). GCP Cloud Run service `phenomatch-web` in project `devo-holding`, region `us-west1`. Cloudflare is **DNS-only** (grey cloud) — no Workers, no orange-cloud proxy.

The production image runs `npm ci && npm run build`, then the Node API in `server/` serves `/api/*` and the Vite `dist/` assets on `0.0.0.0:$PORT` (Cloud Run default `8080`). Firestore and secrets are not required to boot a public demo; the in-memory catalog stub is the default.

```bash
gcloud run deploy phenomatch-web --source . --project=devo-holding --region=us-west1 --allow-unauthenticated
```

Optional env (safe defaults for a public demo):

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8080` | Cloud Run injects this. Local `npm run cloud` still uses `MATCH_API_PORT=8787`. |
| `HOST` | `0.0.0.0` | Bind address. Do not use localhost-only binds in production. |
| `STATIC_DIR` | `./dist` | Built UI. Set only if assets live elsewhere. |
| `GCP_PROJECT_ID` | `devo-holding` | Reported by `/api/health` and `/api/gcp`. |
| `GCP_REGION` | `us-west1` | Reported by stubs. |
| `CLOUD_RUN_SERVICE` | `phenomatch-web` | Reported by stubs. |
| `FIRESTORE_DATABASE` | `(default)` | Unused until Firestore is wired. |

No `GOOGLE_APPLICATION_CREDENTIALS` is required. Until Firestore is wired, `GET /api/health` reports `mode: memory-stub`.

## Holding

Repo: [atla-o/phenomatch](https://github.com/atla-o/phenomatch)  
Sibling: [atla-o/antiporn](https://github.com/atla-o/antiporn) (same process)  
Holding: [atla-o/devo](https://github.com/atla-o/devo)  
GCP: `devo-holding` (org `atla-o.com`, folder `Devo`). App data is GCP, not Firebase.

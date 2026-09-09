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

Public host: [https://phenomatch.devoutshaman.com](https://phenomatch.devoutshaman.com). GCP Cloud Run service `phenomatch-web` in project `devo-holding`, region `us-west1`. Cloudflare is **DNS-only** (grey cloud) to `ghs.googlehosted.com` — no Workers, no orange-cloud proxy.

**Push or merge to `main` updates this host.** There is no separate beta host. Do not deploy to GCP from a cloud agent; GitHub Actions on `main` is the path.

The production image runs `npm ci && npm run build`, then the Node API in `server/` serves `/api/*` and the Vite `dist/` assets on `0.0.0.0:$PORT` (Cloud Run default `8080`). Firestore and secrets are not required to boot a public demo; the in-memory catalog stub is the default.

### Auto-deploy

[`.github/workflows/deploy-cloudrun.yml`](.github/workflows/deploy-cloudrun.yml) runs on push to `main` (and `workflow_dispatch`) and deploys:

```bash
gcloud run deploy phenomatch-web --source . --project=devo-holding --region=us-west1
```

Do **not** pass `--allow-unauthenticated`. Org policy blocks `allUsers` IAM.

A short [`cloudbuild.yaml`](cloudbuild.yaml) is included for a future Cloud Build GitHub trigger (same service, region, project). GitHub Actions is the primary path.

### One-time setup (Devo operator: `account@atla-o.com`)

Fill in placeholders. Do not invent credentials.

**GitHub Actions auth** — set these on `atla-o/phenomatch` (Settings → Secrets and variables → Actions) before the first auto-deploy:

| Name | Where | Placeholder |
| --- | --- | --- |
| `GCP_WIF_PROVIDER` | repository **variable** (preferred) | `projects/PROJECT_NUMBER_PLACEHOLDER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_WIF_SERVICE_ACCOUNT` | repository **variable** (preferred) | `phenomatch-github-deploy@devo-holding.iam.gserviceaccount.com` |
| `GCP_SA_KEY` | repository **secret** (fallback) | JSON key for a deploy service account. Used only when `GCP_WIF_PROVIDER` is unset. Prefer WIF. |

Replace `PROJECT_NUMBER_PLACEHOLDER` with the real `devo-holding` project number (`gcloud projects describe devo-holding --format='value(projectNumber)'`). WIF bootstrap commands and IAM roles are in [gcp/README.md](gcp/README.md).

**Public access** — after the first deploy of a new service, disable the invoker IAM check (already true on the live `phenomatch-web` service):

```bash
gcloud run services update phenomatch-web \
  --project=devo-holding \
  --region=us-west1 \
  --invoker-iam-check=disabled
```

Equivalent: annotation `run.googleapis.com/invoker-iam-disabled=true`, or `--no-invoker-iam-check`. Later deploys keep this setting unless you re-enable the check.

### Manual deploy

```bash
gcloud run deploy phenomatch-web --source . --project=devo-holding --region=us-west1
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

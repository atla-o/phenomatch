# GCP stubs — Phenomatch

App data belongs in GCP project **`devo-holding`** (org `atla-o.com`, folder `Devo`). Not Firebase.

This folder is documentation and deploy *shape* only. Cloud agents must not apply infrastructure or publish production services from this checkout.

| Resource | Stub |
| --- | --- |
| Project | `devo-holding` |
| Cloud Run | `phenomatch-web` in `us-west1` — public host `phenomatch.devoutshaman.com` (Cloudflare DNS-only to `ghs.googlehosted.com`, no Workers). See `cloud-run.yaml` |
| Firestore | collections `phenomatch_phenotypes`, `phenomatch_candidates`, `phenomatch_match_queries`, `phenomatch_umingle_guests`, `phenomatch_umingle_rooms`, `phenomatch_gene_uploads` |
| Runtime | Matching API (`server/index.mjs`) uses an in-memory catalog until credentials exist |

Wire `@google-cloud/firestore` in `server/gcp.mjs` when a service account for `devo-holding` is available. Until then `GET /api/gcp` reports `mode: memory-stub`.

## Deploy path

Push or merge to `main` deploys `phenomatch-web` via GitHub Actions. There is no separate beta host. A future Cloud Build GitHub trigger can use repo-root [`cloudbuild.yaml`](../cloudbuild.yaml) (same service, region, project). GitHub Actions is the primary path.

```bash
gcloud run deploy phenomatch-web --source . --project=devo-holding --region=us-west1
```

Do **not** pass `--allow-unauthenticated`. Org policy blocks `allUsers` IAM.

### Public access (invoker IAM)

After the **first** deploy of a new service, operators disable the invoker IAM check instead of granting `allUsers`:

```bash
gcloud run services update phenomatch-web \
  --project=devo-holding \
  --region=us-west1 \
  --invoker-iam-check=disabled
```

Equivalent annotation: `run.googleapis.com/invoker-iam-disabled=true` (gcloud also accepts `--no-invoker-iam-check`). The live `phenomatch-web` service already has this. Later `gcloud run deploy` revisions keep it unless you re-enable the check.

Cloudflare stays DNS-only (grey cloud) to `ghs.googlehosted.com`.

### GitHub Actions auth (Devo operator: `account@atla-o.com`)

Fill in placeholders. Do not invent credentials.

**Preferred: Workload Identity Federation**

Repository **variables** on `atla-o/phenomatch`:

| Variable | Placeholder |
| --- | --- |
| `GCP_WIF_PROVIDER` | `projects/PROJECT_NUMBER_PLACEHOLDER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_WIF_SERVICE_ACCOUNT` | `phenomatch-github-deploy@devo-holding.iam.gserviceaccount.com` |

Suggested resource names (create these; they are not credentials): pool `github-pool`, provider `github-provider`, SA `phenomatch-github-deploy`.

```bash
PROJECT_ID=devo-holding
PROJECT_NUMBER=PROJECT_NUMBER_PLACEHOLDER   # replace: gcloud projects describe devo-holding --format='value(projectNumber)'
POOL_ID=github-pool
PROVIDER_ID=github-provider
SA_EMAIL=phenomatch-github-deploy@${PROJECT_ID}.iam.gserviceaccount.com
GITHUB_REPO=atla-o/phenomatch

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  --project="${PROJECT_ID}"

gcloud iam workload-identity-pools create "${POOL_ID}" \
  --project="${PROJECT_ID}" --location="global" \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
  --project="${PROJECT_ID}" --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'"

gcloud iam service-accounts create phenomatch-github-deploy \
  --project="${PROJECT_ID}" \
  --display-name="Phenomatch GitHub Actions deploy"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.admin"

# Act as the Cloud Run runtime SA (Compute Engine default unless customized):
gcloud iam service-accounts add-iam-policy-binding \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}"
```

`roles/storage.admin` is for Cloud Build source staging when using `gcloud run deploy --source`. Tighten to the staging bucket if you prefer.

**Fallback: service account key**

Repository **secret** `GCP_SA_KEY` = JSON key for a deploy SA with the same roles. Long-lived; prefer WIF. The workflow uses this only when `GCP_WIF_PROVIDER` is unset.

### Future Cloud Build trigger

Create Artifact Registry repo `phenomatch` in `us-west1` if it does not exist, then point a GitHub trigger at repo-root `cloudbuild.yaml` (image `us-west1-docker.pkg.dev/devo-holding/phenomatch/web`, service `phenomatch-web`). Still do not add `--allow-unauthenticated`.

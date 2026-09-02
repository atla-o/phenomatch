# GCP stubs — Phenomatch

App data belongs in GCP project **`devo-holding`** (org `atla-o.com`, folder `Devo`). Not Firebase.

This folder is documentation and deploy *shape* only. Cloud agents must not apply infrastructure or publish production services from this checkout.

| Resource | Stub |
| --- | --- |
| Project | `devo-holding` |
| Cloud Run | `phenomatch-matching-api` in `us-central1` — see `cloud-run.yaml` |
| Firestore | collections `phenomatch_phenotypes`, `phenomatch_candidates`, `phenomatch_match_queries` |
| Runtime | Matching API (`server/index.mjs`) uses an in-memory catalog until credentials exist |

Wire `@google-cloud/firestore` in `server/gcp.mjs` when a service account for `devo-holding` is available. Until then `GET /api/gcp` reports `mode: memory-stub`.

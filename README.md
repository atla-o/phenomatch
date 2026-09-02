# Phenomatch

A Devo product. Matches people by phenotype. Revenue toward Devo's fertility program.

This GitHub repo is the **cloud workspace**: web app, matching API, GCP stubs, GitHub, docs.

Camera, overlay, audio, native Mac, installer, and simulator stay on the local Mac agent. Do not run this product cloud-only.

## Cloud

```bash
npm install
npm run cloud -- --host 0.0.0.0 --port 5173
```

Black-and-white Pheno / Match UI. Match categories: cluster (virginity, genealogy, age filters) and anonymous. Anonymous match has a profile match function: no account, phenotype chat.

See [docs/cloud.md](docs/cloud.md) and [gcp/README.md](gcp/README.md).

## Holding

Repo: [atla-o/phenomatch](https://github.com/atla-o/phenomatch)  
Sibling: [atla-o/antiporn](https://github.com/atla-o/antiporn) (same process)  
Holding: [atla-o/devo](https://github.com/atla-o/devo)  
GCP: `devo-holding` (org `atla-o.com`, folder `Devo`). App data is GCP, not Firebase.

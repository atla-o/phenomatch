# Phenomatch

Phenotype matching under **Devo**. Same process as Antiporn: half cloud / half local. See [AGENTS.md](./AGENTS.md).

## Split

| Cloud agents | Local Mac |
| --- | --- |
| Web app, backend, GCP (`devo-holding`), GitHub, docs | Camera scan, overlay, audio, native client, installer |

Not cloud-only. Not strictly local.

## Local Mac (this checkout)

Vite + React UI. Pheno / Match. Black and white. Visual traits + tribe + genealogy cluster. Scan uses the device camera.

```bash
npm install
npm run dev
```

Open http://localhost:5173/

## Cloud / GitHub

Repo: [atla-o/phenomatch](https://github.com/atla-o/phenomatch)  
Holding: [atla-o/devo](https://github.com/atla-o/devo)  
Sibling: [atla-o/antiporn](https://github.com/atla-o/antiporn)

# Devo product workspace

Same process for Phenomatch and Antiporn. Do not invent a different workflow per product.

## Half cloud / half local

- **Cloud (Cursor cloud agent):** web app, backend, GCP, GitHub, docs.
- **Local Mac (Cursor on the machine, or Cursor My Machines):** anything that needs the device — overlay, audio, camera, native client, installer, simulator.

A Linux cloud VM cannot drive local audio or UI. Do not run this product cloud-only. Do not run it strictly local.

## Holding

Devo. GitHub publisher [`atla-o`](https://github.com/atla-o). GCP project `devo-holding` (org `atla-o.com`, folder `Devo`). App data is GCP, not Firebase.

## This product

Phenotype matching. Revenue toward Devo's fertility program.

- Repo: [atla-o/phenomatch](https://github.com/atla-o/phenomatch)
- Sibling: [atla-o/antiporn](https://github.com/atla-o/antiporn) (same process)
- Holding: [atla-o/devo](https://github.com/atla-o/devo)

## Cursor Cloud specific instructions

This GitHub repo is the cloud workspace. Cloud agents clone `atla-o/phenomatch` — they do not use a local folder.

- Install: `npm install` (see `.cursor/environment.json`).
- Web/dev server: `npm run dev -- --host 0.0.0.0 --port 5173`.
- Build check: `npm run build`.
- Do not implement camera, overlay, audio, native Mac, or installer in cloud. Those stay on the local Mac agent.
- App data belongs in GCP project `devo-holding`, not Firebase.

# Devo product workspace

Same process for Phenomatch and Antiporn. Do not invent a different workflow per product.

## Half cloud / half local

- **Cloud (Cursor cloud agent):** web app, backend, GCP, GitHub, docs.
- **Local Mac (Cursor on the machine, or Cursor My Machines):** anything that needs the device — overlay, audio, camera, native client, installer, simulator.

A Linux cloud VM cannot drive local audio or UI. Do not run this product cloud-only.

## Holding

Devo. GitHub publisher [`atla-o`](https://github.com/atla-o). GCP project `devo-holding` (org `atla-o.com`, folder `Devo`). App data is GCP, not Firebase.

## This product

Phenotype matching. Revenue toward Devo's fertility program.

- Repo: [atla-o/phenomatch](https://github.com/atla-o/phenomatch)
- Sibling: [atla-o/antiporn](https://github.com/atla-o/antiporn) (same process)
- Holding: [atla-o/devo](https://github.com/atla-o/devo)

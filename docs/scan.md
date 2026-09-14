# Phenotype scan

Scan type scores a camera frame (or a still) for **visible identifiers** and assigns the nearest catalog type. This is cluster similarity, not a medical, genetic, ancestry, or ethnicity test.

## Pipeline

1. Browser opens the user-facing camera (`getUserMedia`, video only) or accepts a still image.
2. MediaPipe Face Landmarker (WASM) finds face landmarks on a captured frame.
3. `shared/face-traits.mjs` samples the frame and landmark ratios into trait scores, including **tribe**.
4. `POST /api/phenotype/scan` validates the vector, **recomputes tribe on the server**, and assigns the nearest type from `shared/phenotype-catalog.mjs`.
5. The assigned type + the person’s trait vector persist in Firestore (`devo-holding`) in production.

## Heuristic mapping

These scores move with lighting, pose, makeup, and camera white-balance. They are not biochemical or genomic measurements.

| Trait | Signal | Mapping |
| --- | --- | --- |
| Melanin | Forehead and cheek patches | Inverse CIE L* of skin samples. Darker visible skin → higher score. |
| Eye color | Iris patches | Lightness plus blue/green hue. Light eyes → higher score. |
| Hair | Band above the forehead | Inverse lightness. Darker hair region → higher score. |
| Nose | Nostril width / face width | Wider visible nose → higher score. |
| Lips | Lip height / mouth width | Fuller visible lips → higher score. |
| Facial | Face width / face height | Rounder vs longer face. |
| Jaw | Jaw width / face width | Broader mandibular outline. |
| Cheekbone | Zygomatic width vs jaw | Higher/wider cheek outline. |
| **Tribe** | Composite of the above plus intercanthal and mouth-width ratios | A visible-identifier cluster coordinate used in nearest-type assignment. **Not tribal membership, DNA, or ethnicity.** |

Tribe is computed on the server from the analyzed traits (and optional extra geometry). The client cannot persist a random stub tribe independently of the face vector.

## Catalog

`shared/phenotype-catalog.mjs` lists types with trait centroids, including tribe. Different real faces should land on different types because centroids are spread across pigmentation, iris, breadth, and relief.

Gene file upload is unchanged and still links genealogy metadata onto the scanned phenotype.

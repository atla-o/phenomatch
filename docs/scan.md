# Phenotype scan

Scan type scores a camera frame (or a still) for **visible bone spacing, cartilage, hair, and shade**, then assigns the nearest **heritage type**. This is cluster fit from a face readout, not a laboratory genome, medical test, or ethnicity assay.

## Pipeline

1. Browser opens the user-facing camera (`getUserMedia`, video only) or accepts a still image.
2. MediaPipe Face Landmarker (WASM) finds face landmarks on a captured frame.
3. `shared/face-traits.mjs` measures bone spacing (jaw, cheekbone, midface, inter-ocular), cartilage (nose length, ear if visible), hair thickness, and shade. **Tribe** is derived from those signals.
4. `POST /api/phenotype/scan` validates the vector, **recomputes tribe on the server**, assigns the nearest heritage type, and persists a phenotype-derived `genomeReadout`.
5. Production writes Firestore in `devo-holding`.

## Heuristic mapping

These scores move with lighting, pose, makeup, and camera white-balance. They are not biochemical or genomic measurements.

| Signal | What is measured | Mapping |
| --- | --- | --- |
| Bone | Jaw width, cheekbone width, midface length, inter-ocular spacing, facial thirds | Aspect-corrected landmark ratios. |
| Cartilage | Nose length/projection; ear length when landmarks exist | Longer visible cartilage → higher cartilage score, blended into nose. |
| Hair thickness | Luminance spread in the hair band | Texture/density proxy, blended into hair pattern. |
| Shade | Skin and iris patches | Melanin = inverse CIE L*; eye color = lightness + blue/green hue. |
| **Tribe** | Bone + cartilage + hair + shade + spacing | Heritage-cluster coordinate used in type assignment. **Not tribal membership or DNA.** |

The headline result is a **heritage type** plus cluster fit. The genome-like strip is secondary flavor: marker IDs and A/G-style calls are **guessed from the face trait vector**, deterministic on rescan, and labeled as not measured alleles.

## Catalog

`shared/phenotype-catalog.mjs` lists heritage lineages people can identify with. Centroids include tribe. Different real faces should land on different types.

Gene file upload is unchanged and still links genealogy metadata onto the scanned phenotype.

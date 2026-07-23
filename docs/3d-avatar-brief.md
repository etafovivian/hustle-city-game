# 3D avatar brief (hybrid plan)

**Decision (2026-10-11):** the map, shop and UI stay 2D. The **avatar** becomes a real 3D model: you can drag to spin it and swap outfits on it, in onboarding and in the Phone's profile, the way Lagos Life does.

Stitch makes images, not 3D models. A real 3D avatar needs **`.glb` model files**. The Stitch renders we already have (`apps/web/public/art/characters`, `outfits`) are the visual reference for them.

## What I need from you

You can get these in one of two ways:

| Path | How | Cost / effort |
|------|-----|---------------|
| **A. Image-to-3D tool** (recommended) | Upload our Stitch character and outfit renders to **Meshy** or **Tripo3D**, then export **rigged** `.glb` (humanoid rig, A-pose or T-pose). | Paid credits (a few dollars per model). Fastest. |
| **B. Free base + textures** | I start from a free CC0 base character (e.g. a Quaternius or Kenney humanoid) and you get only **textures** from Stitch (Ankara, Adire, Aso-oke fabric swatches). | Free, but less likeness to the Stitch characters. |

### Models for path A (one `.glb` each)

1. **Base body, woman.** Use `characters/woman-ankara-puff.webp` as the reference, with the clothing removed or neutral: plain fitted base layer, rigged, about 4,000 triangles.
2. **Base body, man.** Use `characters/man-agbada-fila.webp` as the reference, neutral base layer, rigged, about 4,000 triangles.
3. **Hair and headwear** as separate meshes that fit the base head:
   - low-cut fade
   - braided high puff
   - twist locs
   - buzz cut
   - gele headwrap
   - fila cap
4. **Outfits** as separate meshes that fit the matching base body (refs in `outfits/`):
   - cream agbada with gold embroidery
   - Ankara peplum dress
   - indigo embroidered kaftan
   - casual tee and joggers

Every file needs:
- format `.glb`, Y-up, real-world scale (base about 1.75 m);
- one material per mesh, with a texture of 1024 px or less;
- a humanoid rig on the bodies;
- clothing that is skinned to the same rig.

These limits keep the avatar smooth on mid-range Android, matching `docs/stitch/3d-asset-spec.md`.

## What I'll build when the models arrive

- A Three.js avatar viewer, loaded only when it's shown so the rest of the app stays light:
  - drag to spin, soft studio lighting, the gold ring floor;
  - skin tone applied as a tint on the base material, matching our six tones;
  - hair and outfits swapped in and out as separate meshes;
  - falls back to the current 2D avatar on low-end devices or if WebGL fails.
- The avatar choice is already stored per player. The 3D viewer reads the same `skinTone`, `hairStyle` and `outfit` values, so no data changes are needed.

# Avatar research: Lagos Life vs Naija Hustle City

Looked at 2026-10-12 on lagoslife.app, signed in as the owner (male character, about 87k players online). This was read-only: nothing was bought, saved or changed. We record only how their avatars work. We do not copy their art.

## What Lagos Life has

### Where you change your look
- **There is no character creator in the game.** Settings has no "edit look". The only path to a new body is "Start a new life…", which wipes the save, so we did not open it. Body, face and skin are picked once at sign-up.
- **Lagos Boutique** (Phone → Boutique). On the left is a full-height 3D turntable with the text "Drag to turn" and "Trying on · <item>". On the right is a shop grid. Tap an item to try it on, pick a colour from the swatches, then press "Buy and wear". Prices are in game naira.

| Tab | Items | Colours per item | Examples (cheap → expensive) |
|---|---|---|---|
| Clothes (as seen on a man) | 10 | 1–7 (most have 5–6) | Tee & jeans ₦15k, Hoodie & jeans, Adire two-piece, Ankara shirt & chinos, Streetwear fit, Senator kaftan, Tailored suit, Aso-oke agbada ₦450k, Designer tracksuit, Bespoke tuxedo ₦1.8m |
| Shoes | 12 | 4–8 | Pam slides, sneakers, loafers, heels, palm slippers, oxfords … diamond-studded sneakers ₦15m |
| Bags | 12 | 3–6 | Ghana Must Go, raffia basket, Ankara tote, Adire bag … diamond designer bag ₦50m |
| Wigs (their only hair option) | 15 | 8 each | synthetic bob, pixie curls, fringe, bone straight, 30-inch, ginger bob, deep wave, afro puff, ponytail, faux locs, knotless braids, body-wave lace, raw donor hair |

- **They have none of these:** beards, gele, fila or other headwear, glasses, jewellery, separate face options.
- **Small tags on items:** "Made in Abeokuta", "Owambe king", "Lekki drip", "No 8-hour sitting", "Big girl status". These cost almost nothing to make and do a lot of the selling.
- **"Wear for" slots:** Everyday, Home, Sleep, Date night, Party, Work and Gym. Each slot has a sensible default, such as matching pyjamas for Sleep, a Super Eagles kit for Gym, an Ankara party fit for Party and smart clothes for Work. You can keep that default or pick any clothes you own. The avatar changes outfit automatically for each activity.

### How it looks
- **3D, low-poly and flat-shaded.** The facets are visible, and there are no textures except a printed pattern on some shirts. Proportions are realistic (about 7 heads tall, small head). The face is simple and painted: brows, eyes and a nose ridge.
- **They use stock CC0 models.** The page loads `/models/chars/{m_casual, m_casual2, m_smart, m_party, m_work, f_casual, f_work}.glb`, each about 280 KB. The mesh names (`Suit_Body`, `Casual2_Head`, `Beach_Legs`), the 62-joint `CharacterArmature` and the clip names show these come from **Quaternius' Ultimate Modular Men/Women packs (CC0)**. They are untextured: one plain colour material per part ("Skin", "Suit", "Tie"), compressed with glTF-Transform and meshopt.
- **Each outfit is a whole-body model recoloured.** Shop items map to about 7 base outfits, with the colour changed per swatch.
- **Their traditional clothes are weak.** The "Aso-oke agbada" (₦450k) shows as the beach outfit: a sleeveless top and shorts in burgundy with two gold stripes. The "Senator kaftan" shows as a cream vest and shorts. There is no wide agbada, no long kaftan and no gele. The **tailored suit** is the most convincing outfit: a real jacket and trousers with white shirt cuffs.
- **Wigs look like they are built in code.** No wig model files loaded. The knotless braids are a dark cap with straight strands. The wig thumbnails are live head-and-shoulders renders of the player's own avatar on soft gradient backgrounds. Clothes thumbnails are just emoji.
- **Animations:** only 6 clips (Idle, Idle_Neutral, Walk, Run, Interact, Wave). There are no dances or sitting clips in the file.

### How it is shown
- **Boutique:** a soft lilac-to-white gradient, a pale disc to stand on, even soft light with no hard shadows, and a camera that frames the whole body at a long lens.
- **In venues:** an isometric-style 3D room. Every player has a blue "@handle" tag with a green online dot. Some have status icons (a gold crown over one player). NPCs are tagged with their name ("Mama Nkechi"). About 10–15 avatars stand, walk or sit on benches. Because each outfit is a recolour, the crowd still looks varied: many hues and many wigs.
- **On the street:** a third-person chase camera. Your needs show on the avatar (flies when "Smelly") and the current action floats over your head as an icon (☀️ for sunbathing). This is noted in `lagos-life-places.md`.

## What makes theirs look good
1. **One consistent style.** Low-poly, flat colours and no textures, so nothing looks out of place, and it runs on cheap phones.
2. **Colour, not new meshes, gives the variety.** About 7 meshes × 4–8 swatches × 15 wigs × 12 shoes × 12 bags gives thousands of looks. A busy venue never looks cloned.
3. **The turntable works like a shop window.** The model is large on a clean gradient with soft light. Changes show at once and it is one tap to try something on. Thumbnails are rendered with your own avatar.
4. **The text does a lot of the work.** Lagos names, small tags and price tiers make a plain mesh feel like an "Owambe king" outfit.
5. **The avatar shows what is happening.** Outfits change with the activity, and icons and effects appear on the avatar. It feels alive even with only 6 animations.
6. **It reads well from a distance.** Clear silhouettes, bright fabric colours and name tags above heads.

## Gap vs ours
| | Lagos Life | Us |
|---|---|---|
| Body | Quaternius modular, low-poly, painted face | Quaternius Universal Base (smoother, more realistic, no painted face features) |
| Traditional wear | Faked (vest + shorts) | **Better:** real loose skinned agbada, kaftan, buba + wrapper and peplum (`garments.py`) |
| Hair/headwear | 15 wigs × 8 colours | 11 styles including **gele and cap** (they have none), one colour each |
| Outfits | ~10 per sex × 5–6 colours | 8 fixed outfits (6–7 per body), **no colour choice** |
| Shoes/bags/accessories | 12 / 12 / 0 | none (feet are painted a colour) |
| Fabric | flat, plus a pattern on some shirts | shader polka-dot "Ankara" on body regions only; **the garment meshes are one flat colour** |
| Context outfits | 7 slots with defaults | none |
| Presentation | Big turntable, gradient, try-on and live thumbnails | Turntable with drag, gold ring floor and rim light, **in onboarding only** |
| In-world | 3D avatars and tags everywhere | 2D sprites on the map |
| Animations | 6 | Quaternius Universal Animation Library (many clips, including dance, sit and talk) |

**Summary:** our base and our traditional garments are already ahead. They win on **number of options, colour variants, accessories and presentation**, not on model quality.

## Plan for us (ranked)

1. **Colour swatches for every outfit, hair and garment (code only, about 1 day).**
   - Add `outfitColor` and `hairColor` to `AvatarConfig` in `packages/shared/src/profile.ts`, with 5–8 curated swatches for each.
   - Garments: set `material.color` at runtime.
   - Body paint: change the `regionColors` input.
   - This multiplies our looks the same way theirs are multiplied.
2. **Real Nigerian fabric on the garments (Blender plus Stitch).**
   - In `garments.py`, add UV unwrapping (cylindrical, per ring) and export a texture slot. Today `make_mat` gives one flat colour.
   - Use **Google Stitch** to make tileable 512 px swatches: Ankara wax prints, adire indigo, aso-oke stripes and agbada neck embroidery. Make the swatches greyscale or two-tone so the runtime swatch colour can tint them.
   - This is the one thing they cannot match: a real agbada in real aso-oke.
3. **More garments from the same generator (Blender, scripted).** Each one is a new `build_*` function in `garments.py`:
   - senator two-piece (straight long top and trousers);
   - iro and buba with **ipele** (shoulder shawl);
   - long kaftan dress (women);
   - boubou;
   - agbada with a **fila** cap set;
   - school uniform or NYSC khaki (work slot);
   - pyjamas or wrapper (sleep slot).
   Also add shoes and slippers as simple skinned meshes on the foot bones, and a `shoes` field.
4. **Headwear and hair pieces (Blender `hair.py`).**
   - New pieces: second gele shape (fan or "aso-oke"), fila/abeti-aja, beanie, kufi, durag, bonnet (sleep).
   - Beards (stubble, goatee, full) as a separate slot on the man.
   - Glasses (2–3 frames) as a rigid piece on the head bone.
   - Hair colour can be a tint, since our hair is a mesh.
5. **Turntable polish (code).**
   - Use a soft gradient backdrop and a contact shadow, for example a `ShadowMaterial` plane or a blurred radial texture.
   - Pick an idle variant at random and play a Wave or Dance clip when an item is tried on (the clips are already in our library).
   - Render picker thumbnails with the player's own avatar from an offscreen `WebGLRenderer`, and cache them as data URLs.
   - Use the same viewer for a profile "Wardrobe" screen, not just onboarding.
6. **Outfits per activity.** Store `wearFor: {sleep, work, party, gym}` with defaults. The 2D street sprites and any future 3D venue pick the slot that matches the activity. Give items Lagos-flavoured names and short tags (our own wording).
7. **Painted face features.** Add eyes, brows and lips as a small decal texture, or as extra shader regions on the head of the Universal Base body. Offer 3–4 face presets. This is a quick win for readability at turntable size.
8. **Later: 3D avatars in venues.** The body GLBs are about 780 KB. Make a LOD (decimate in Blender to around 3k triangles) and share one material atlas before showing 10+ players. Until then, keep the 2D sprites. Use Stitch to render sprite sheets from the 3D avatar (turntable captures) so the 2D and 3D looks match.

### Where each asset comes from
- **Blender on studio-3d-01 (scripted, original work):** all garments, shoes, headwear, beards, glasses, LODs and UV layouts. Keep using the `garments.py` and `hair.py` approach. Previews go to the Workbench renders that exist today.
- **Google Stitch (2D only):** fabric swatches and embroidery motifs as textures; concept sheets for new outfits before modelling; shop thumbnails or background art if we don't render them live; 2D walk sprites to match the 3D looks.
- **Outside assets, only if needed (CC0 or CC-BY only; credit the CC-BY ones in `public/models/LICENSE.txt`):**
  - **Quaternius** (CC0): we already use these. The Ultimate Modular Men/Women packs are what Lagos Life uses, so **avoid them**, or our crowd will look like theirs.
  - **MakeHuman / MPFB2 for Blender** (exported models are CC0): more body shapes and face variety on our own rig.
  - **Kenney** (CC0): props, and small accessory shapes such as bags and glasses.
  - **ambientCG** and **Poly Haven** (CC0): fabric normal and roughness maps (linen, cotton, brocade) to put under our Stitch prints.
  - **Poly Pizza / Sketchfab:** only models marked CC0 or CC-BY, checked one by one.
  - **Do not use:** Mixamo or Ready Player Me (not CC licences), or anything traced from Lagos Life's renders.

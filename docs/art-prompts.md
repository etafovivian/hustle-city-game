# Art brief — Naija Hustle City (ChatGPT / Gemini)

The goal is one consistent set of game-quality art for Junction 101. Generate each asset in the **same chat**, so the model keeps the style. Paste the **style block** first, then one asset prompt at a time.

## How to use

1. Paste the style block below, then the asset prompt.
2. Ask for a **transparent background, PNG**. If the tool can't do transparency, ask for a plain flat `#FF00FF` background and I'll cut it out.
3. If a result drifts in style, reply: *"Match the exact style, lighting, camera angle and palette of the first image."*
4. Save the files with the names below and send them to me, or drop them in `apps/web/public/art/`. I'll optimise them to WebP, wire them into `public/art/manifest.json`, and check them on desktop and phone.

Check the tool's terms. Images you generate in ChatGPT or Gemini are yours to use commercially under their current terms, but keep the prompts in this file as provenance.

---

## Style block (paste first, every time)

> Isometric 3D game art for a modern 2026 mobile city-builder set in Lagos, Nigeria.
>
> - **Camera:** true isometric view, 30° elevation, the building's front corner facing the viewer, slightly to the right.
> - **Look:** soft stylised 3D, clay-like materials with subtle texture, rounded bevelled edges and gentle global illumination. Warm late-afternoon Lagos sunlight comes from the top-left, casting a soft contact shadow under the object. Clean silhouette, crisp detail, premium quality like a top-grossing 2026 mobile game. Not childish, not flat vector, not photoreal.
> - **Palette** (use as the dominant colours): indigo `#1F2A6B`, cadmium yellow `#F2B705`, madder red `#C8321E`, leaf green `#1E7A46`, unbleached cotton `#F7F4EA`. Concrete and wood stay neutral warm grey and brown.
> - **Culture:** authentically Nigerian and Lagos street life: Ankara/wax-print fabric, corrugated roofing, painted signboards, a small generator, potted plants, palm trees.
> - **Rules:** no readable text, letters, logos or brand names anywhere (signboards show abstract shapes only), and no people. Single object centred, full object visible, nothing cropped. Transparent background.

---

## Assets

### 1. `market-square.png` — 1600 × 1250, transparent
> Using the style block: a lively open-air Lagos market corner on a small square concrete plot. Three market stalls stand side by side under large wax-print umbrellas. The umbrella fabric is Ankara print: indigo concentric circles on cadmium yellow with small madder-red diamonds. The stalls hold stacked sachet water bags, small phone accessories on a pegboard, a recharge-card kiosk box, and woven baskets of produce. The wooden stall counters are painted madder red with cotton-white trim. A blue plastic stool and a small yellow generator sit to one side, with string lights between the umbrella poles.

### 2. `work-hub.png` — 1600 × 1250, transparent
> Using the style block: a modern four-storey co-working office building in Yaba, Lagos, on a small square plot. The facade is concrete and glass with indigo-tinted windows; some windows glow warm yellow from inside. A horizontal band of wax-print panelling runs under the roof: leaf-green stepped bricks with small yellow tick marks on indigo. There are a few solar panels and an AC unit on the roof, a covered entrance with a yellow canopy, a parked okada (motorbike) by the entrance, and one palm tree in a planter.

### 3. `hangout.png` — 1600 × 1250, transparent
> Using the style block: a relaxed Lagos neighbourhood "joint", a one-storey lounge and snack bar on a small square plot. The front canopy is wax-print fabric: yellow quarter-circle fans with madder-red radiating lines and indigo dots on a red ground. The walls are leaf green with cotton-white trim. A small outdoor seating area has red plastic chairs and tables, string lights, a speaker on a stand, a cooler box, and a suya grill with a little smoke.

### 4. `danfo.png` — 1200 × 800, transparent
> Using the style block: an iconic Lagos danfo minibus (a yellow Volkswagen-style bus) with two black horizontal stripes. The side door is open, the roof rack carries a few bags, and the bodywork shows small dents and character. The windows have a slight indigo tint. No text on the bus. Shown alone, facing right.

### 5. Optional: `junction-ground.png` — 1600 × 1040, opaque
> Using the style block: a top-down isometric ground tile for a small Lagos junction. Two roads cross in the middle around a small roundabout, with a raised circular planter in the centre. The asphalt is warm grey with faded dashed lane lines. There are kerbs, sandy roadside patches, two grassy corners with palm trees, and a gutter. Leave clear empty plots in the top-right, bottom-left and bottom-right quadrants (buildings are placed there separately). No buildings, no vehicles, no text.

### 6. App icon: `app-icon.png` — 1024 × 1024, opaque
> Using the style block's palette and finish: a mobile app icon for "Naija Hustle City". A single bold isometric market stall with an Ankara-print umbrella (indigo circles on yellow) on a rich indigo `#1F2A6B` rounded-square background, with a soft glow behind the stall. Simple and readable at 48px, no text.

---

## Wiring (for me, once files arrive)

`apps/web/public/art/manifest.json` maps each slot to a file:

```json
{
  "market_square": "market-square.webp",
  "work_hub": "work-hub.webp",
  "hangout": "hangout.webp",
  "danfo": "danfo.webp"
}
```

Any slot left out keeps its current vector drawing, so assets can arrive one at a time.

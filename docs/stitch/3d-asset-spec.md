# Naija Hustle City: Stylized Low-Poly 3D Asset & Game Engine Specification

## 1. Technical Performance Budget (Target: Mid-Range Android / Mobile WebGL)
- **Target Frame Rate:** 60 FPS on Mali-G57 / Adreno 610 or equivalent.
- **Draw Call Budget:** Max 45–60 draw calls per scene (leveraging texture atlasing and GLB mesh instancing).
- **Triangle / Poly Budget:**
  - Base Avatar Skeleton (Male/Female): 3,500 – 4,800 tris
  - Clothing Layers (Top/Bottom or Traditional Robes): 800 – 1,800 tris
  - Hair Mesh (Solid low-poly stylized card/mesh): 600 – 1,200 tris
  - Modular Furniture Pieces: 250 – 900 tris each
  - Environment Building Plot (LOD 0): 2,000 – 4,500 tris

## 2. PBR Material & Texture Guidelines
- **Shading Model:** Stylized PBR (Albedo/BaseColor + Roughness/Metallic + Ambient Occlusion + Normal).
- **Atlas Resolution:** 1024x1024 or 2048x2048 shared atlas (RGBA with roughness in Alpha or channel-packed ORM).
- **Format:** glTF 2.0 / Binary `.glb` with Draco compression or meshopt compression for fast mobile asset streaming.
- **Lighting Model:** Directional warm sun (`#FFF3D6`), cool ambient fill (`#2A385B`), subtle spherical harmonics.

## 3. Nigerian Character Customization Standards
- **Skin Tone Tonal Palette:** 6 primary melanin tones (Warm Espresso `#2D1C15`, Deep Cocoa `#3E271E`, Rich Mahogany `#5C3828`, Golden Chestnut `#825036`, Warm Bronze `#A36D48`, Honey Caramel `#C28B5E`).
- **Hairstyles:** Fresh Fade / Low Cut, Dreadlocks / Micro-twists, Braided High Puff, Buzz Cut, Cornrows, Ankara Gele Headwrap, Fila Traditional Cap.
- **Wardrobe Categories:**
  - Traditional Formal: Regal Agbada & Buba robe, Embroidered Kaftan, Aso-oke Danshiki.
  - Modern Afrocentric: Ankara print crop-tops, Adire indigo shorts, modern casual high-tops, slides.
  - Contemporary Casual: Streetwear graphic tees, jogger cargo pants, oversized denim.

## 4. Isometric Home & Shop Editor System
- **Grid Footprint:** 0.5m x 0.5m sub-tiles on a 10x10 or 12x12 living room / boutique shop grid.
- **Camera Angle:** Classic True Isometric 2:1 projection (`tan⁻¹(0.5) ≈ 26.565°` pitch, 45° yaw) and free 360° orbit mode.
- **Snapping & Collision:** AABB bounding box collision with 90° incremental snap rotation (`Q` / `E` or mobile gestures).

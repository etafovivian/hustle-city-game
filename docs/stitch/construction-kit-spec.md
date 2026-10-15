# Hustle City: Modular Isometric Building Construction Kit & Assembly Architecture Spec

## 1. Technical Framework & Sub-Tile Snapping Matrix

This modular construction kit decouples building volumes from perimeter compounds, ground terrain, infrastructure, and landscaping. Every component conforms to a **standardized isometric grid bounding matrix** designed for dynamic browser programmatic assembly, real-time vertical stacking, and runtime roof/interior visibility toggling.

### Coordinate & Snapping Standards
- **Projection Standard:** Classic True Isometric 2:1 (`arctan(0.5) ≈ 26.565°` pitch, 45° yaw).
- **Base Grid Unit:** `1 Plot Unit = 1.0m x 1.0m` (Sub-tile `0.5m x 0.5m`).
- **Standard Structural Footprints:**
  - **S-Module (Single Lock-up / Kiosk):** `2 x 2` grid units (128 x 64 px isometric footprint base).
  - **M-Module (Standard Floor Plate / Commercial Base):** `4 x 4` grid units (256 x 128 px footprint base).
  - **L-Module (Plaza / Compound / High-Rise Block):** `8 x 8` grid units (512 x 256 px footprint base).
- **Vertical Storey Height:** Exactly `96 pixels` per floor level at 100% zoom scale (LOD 0), ensuring zero-gap programmatic vertical concatenation:
  $$\text{Render Position } Y_n = Y_{\text{ground}} - (n \times 96\text{px})$$
- **Snapping Pivot Anchor:** `[0.5, 0.0, 0.5]` (Center-Bottom of the bounding diamond polygon).

---

## 2. Decoupled Modular Library Catalog

### A. Structural Building Modules (Stackable Vertical Slices)
| Module ID | Component Name | Grid Size | Vertical Z-Height | Stacking Interface | Features |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MOD-BASE-01** | **Ground Commercial Base** | 4x4 | 96 px | Flat top rim + dowel snaps | Dual lock-up roll-up shop bays, weathered stucco walls, interior warm lighting glow. |
| **MOD-BASE-02** | **Ground Residential Base** | 4x4 | 96 px | Flat top rim + dowel snaps | Louvered jalousie windows, security burglar bars, central access door, veranda plinth. |
| **MOD-FLR-01** | **Upper Commercial Floor** | 4x4 | 96 px | Bottom socket / Flat top rim | 2 office suites, front access corridor balcony, black iron safety railing, AC compressors. |
| **MOD-FLR-02** | **Upper Residential Floor** | 4x4 | 96 px | Bottom socket / Flat top rim | Balcony corridor, double jalousie windows, conduit wiring, laundry bracket mount. |
| **MOD-FLR-03** | **Upper Penthouse / Executive** | 4x4 | 96 px | Bottom socket / Flat top rim | Tinted curtain glass facade, gold anodized mullions, recessed executive terrace. |
| **MOD-ROOF-01** | **Corrugated Zinc Pitched Roof** | 4x4 | 64 px | Bottom socket snap | Weathered corrugated zinc sheets, timber purlins, TV aerial antenna, downspouts. |
| **MOD-ROOF-02** | **Flat Concrete Parapet + Water Tanks** | 4x4 | 52 px | Bottom socket snap | Concrete parapet coping, steel elevated stand with twin black PVC Geepee tanks. |
| **MOD-ROOF-03** | **Dual Variant Roof (Zinc & Parapet)**| 4x4 | 68 px | Bottom socket snap | Split architectural roof with pitched rusted zinc wing + flat concrete machinery terrace. |

### B. Vertical Circulation & Facade Clip-Ons
| Module ID | Component Name | Grid Size | Height | Attachment Anchor | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MOD-STAIR-01** | **External Concrete/Steel Zigzag Stair** | 2x2 | 96 px | Side-Wall Flange `[+X or -X]` | Industrial non-slip concrete steps, dark iron railings, under-stair storage cage. |
| **MOD-STAIR-02** | **Multi-Storey Stair Tower** | 2x2 | 192 px | Side-Wall Flange | 2-storey modular access stair linking Ground to 2nd Floor. |
| **MOD-BALC-01** | **Balcony Cantilever Extension** | 4x1 | 24 px | Floor Slab Rim | Bolt-on front corridor walkway with patterned decorative guardrails. |
| **MOD-SHUT-01** | **Roll-up Steel Shutter (Closed/Half/Open)**| 2x1 | 48 px | Shop Bay Inset | Dynamic animated state sprites for shop opening/closing gameplay. |

### C. Compound Perimeters & Infrastructure
| Module ID | Component Name | Grid Size | Height | Snap Connection | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MOD-FENC-01** | **Straight Concrete Wall Segment** | 2x0.5 | 36 px | Linear Edge Snap | Weathered plastered concrete wall with top coping and security shards/wire. |
| **MOD-FENC-02** | **Decorative Block Pierced Wall** | 2x0.5 | 36 px | Linear Edge Snap | Classic Lagos breeze-block ventilation screen pattern. |
| **MOD-FENC-03** | **Wall Corner Pillar Segment** | 0.5x0.5 | 40 px | 90° Corner Socket | Structural corner column with mount for outdoor coach lantern or CCTV. |
| **MOD-GATE-01** | **Dual Swing Metal Vehicle Gate** | 3x0.5 | 42 px | Fence Pier Snap | Wrought iron vehicular gate with golden ornamental spearheads. |
| **MOD-GATE-02** | **Pedestrian Security Gate** | 1x0.5 | 42 px | Fence Pier Snap | Single wicket gate for compound pedestrian access. |
| **MOD-POST-01** | **Detached Compound Gatehouse** | 2x2 | 48 px | Ground Placement | Self-contained security post with surveillance window and boom barrier. |
| **MOD-DRIVE-01**| **Interlocking Paved Compound Tile** | 2x2 | 4 px (Flat)| Sub-surface Tile | Red & charcoal geometric interlocking paving stone ground slab. |
| **MOD-PARK-01** | **Single Car Parking Bay** | 2x4 | 4 px (Flat)| Ground Overlay | Demarcated white parking lines with curb stop blocks. |

---

## 3. Assembled Preset Blueprints & Programmatic Formulas

Developers can instantiate pre-configured building typologies by combining the modular IDs according to these programmatic recipes:

```typescript
// Blueprint Specification Data Structures
interface BuildingAssembly {
  blueprintId: string;
  name: string;
  gridFootprint: [number, number];
  levels: {
    levelIndex: number;
    moduleId: string;
    offset: [number, number, number]; // [X, Y_elevation, Z]
    canHideOnInteriorView: boolean;
  }[];
  attachments: {
    anchor: string;
    moduleId: string;
    offset: [number, number, number];
  }[];
  compound?: {
    perimeterWallModule: string;
    gateModule: string;
    gatehouseModule?: string;
    drivewayTile: string;
    parkingBays: number;
  };
}
```

### 1. Four-Unit Roadside Shopping Plaza
- **Grid Footprint:** `8 x 4` (Side-by-side dual base units).
- **Levels:**
  - `Level 0`: 2x `MOD-BASE-01` (Ground Commercial Bases yielding 4 retail lock-ups).
  - `Level Roof`: 2x `MOD-ROOF-01` (Zinc Pitched Roofs with commercial signage).
- **Attachments:** Side utility gen-set cage (`{{DATA:IMAGE:IMAGE_9}}`).
- **Gameplay:** 4 clickable merchant shops (Boutique, Barber, Pharmacy, Provisions).

### 2. Eight-Unit Two-Storey Commercial Plaza
- **Grid Footprint:** `8 x 4`.
- **Levels:**
  - `Level 0`: 2x `MOD-BASE-01` (4 ground retail shops).
  - `Level 1`: 2x `MOD-FLR-01` (4 upper office/salon suites).
  - `Level Roof`: 2x `MOD-ROOF-02` (Concrete Parapets with twin water towers).
- **Attachments:**
  - Left Flange: 1x `MOD-STAIR-01` (External concrete zigzag staircase to 1st floor).
  - Front: 2x `MOD-BALC-01` (Interconnected access balcony).

### 3. Two-Bedroom Bungalow with Fenced Compound
- **Grid Footprint:** Compound `12 x 12` | Building Core `6 x 6`.
- **Levels:**
  - `Level 0`: 1x `MOD-BASE-02` (Residential ground structure with veranda).
  - `Level Roof`: 1x `MOD-ROOF-01` (Pitched corrugated zinc with TV aerial).
- **Compound Assembly:**
  - 18x `MOD-FENC-01` (Perimeter concrete wall).
  - 4x `MOD-FENC-03` (Corner pillars).
  - 1x `MOD-GATE-01` (Vehicular wrought iron gate) + 1x `MOD-GATE-02` (Pedestrian gate).
  - Driveway: `MOD-DRIVE-01` interlocking pavers leading to 1-car carport.
  - Landscaping: 2x Royal Palm Trees and potted crotons.

### 4. Three-Storey Apartment Building with Parking
- **Grid Footprint:** Compound `10 x 14` | Building Core `6 x 6`.
- **Levels:**
  - `Level 0`: 1x `MOD-BASE-02` (Ground flats + entrance foyer).
  - `Level 1`: 1x `MOD-FLR-02` (1st Floor residential flats).
  - `Level 2`: 1x `MOD-FLR-02` (2nd Floor residential flats).
  - `Level Roof`: 1x `MOD-ROOF-02` (Flat parapet with water tank battery).
- **Attachments:** Multi-storey fire escape / access staircase tower.
- **Compound:** 4x `MOD-PARK-01` demarcated vehicle slots, motorized rolling gate.

### 5. Four-Storey Mixed-Use Commercial and Residential Building
- **Grid Footprint:** `8 x 6`.
- **Levels:**
  - `Level 0`: Commercial Ground (`MOD-BASE-01` - Supermarket / Banking Hall).
  - `Level 1`: Professional Offices (`MOD-FLR-01` - Tech co-working & legal suites).
  - `Level 2`: Residential Apartments (`MOD-FLR-02` - 2-bedroom units).
  - `Level 3`: Penthouse Suite (`MOD-FLR-03` - Luxury terrace flat).
  - `Level Roof`: `MOD-ROOF-03` (Hybrid zinc & equipment terrace with satellite dish).
- **Attachments:** Exterior structural staircase `MOD-STAIR-02` + elevator shaft core.

### 6. Luxury Mansion with Detached Gatehouse and Swimming Pool
- **Grid Footprint:** Compound `16 x 16` | Main Villa `8 x 8`.
- **Levels:**
  - `Level 0`: Ground Luxury Villa (Polished marble foyer, double-height living room).
  - `Level 1`: Upper Master Suite with glass wraparound terrace.
  - `Level Roof`: Concealed parapet roof with solar panel array.
- **Compound Assembly:**
  - Detached Gatehouse: `MOD-POST-01` at compound entrance.
  - Recreation: Recessed 2:1 isometric swimming pool tile (`4 x 2` units) with turquoise water shader.
  - Perimeter: High security wall with electric fence toppers, 4 floodlights.

---

## 4. Runtime Rendering, Roof Toggling & Interior Gameplay Pipeline

```javascript
/**
 * Programmatic Building Assembler & Roof Visibility Controller
 */
class HustleCityBuildingInstance {
  constructor(blueprint, coordinates) {
    this.blueprint = blueprint;
    this.x = coordinates.x;
    this.y = coordinates.y;
    this.currentFloorView = 'ALL'; // 'ALL', 'EXTERIOR_ONLY', 'LEVEL_0', 'LEVEL_1', etc.
    this.roofVisible = true;
  }

  toggleRoof(isVisible) {
    this.roofVisible = isVisible;
    const roofElement = document.getElementById(`${this.blueprint.blueprintId}-roof`);
    if (roofElement) {
      roofElement.style.opacity = isVisible ? '1.0' : '0.0';
      roofElement.style.pointerEvents = isVisible ? 'auto' : 'none';
      roofElement.style.transform = isVisible ? 'translateY(0px)' : 'translateY(-24px)';
      roofElement.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    }
  }

  focusInterior(levelIndex) {
    // Hide roof and all floors above targeted interior level
    this.toggleRoof(false);
    this.blueprint.levels.forEach((lvl) => {
      const el = document.getElementById(`${this.blueprint.blueprintId}-lvl-${lvl.levelIndex}`);
      if (el) {
        if (lvl.levelIndex > levelIndex) {
          el.style.opacity = '0.15'; // Ghost out upper levels
        } else {
          el.style.opacity = '1.0';
        }
      }
    });
  }
}
```

---

## 5. Chroma-Key `#FF00FF` Alpha Channel Stripping Specification

All construction kit assets are rendered on solid chroma magenta `#FF00FF` RGB `(255, 0, 255)`. To generate production-ready 32-bit transparent PNG tiles with anti-aliased dark cartoon edges:

1. **Automated FFmpeg CLI Batch Conversion:**
   ```bash
   ffmpeg -i modular_asset.png -vf "colorkey=0xFF00FF:0.08:0.02" -pix_fmt rgba modular_asset_transparent.png
   ```
2. **WebGL Custom Fragment Shader (Zero CPU Overhead):**
   ```glsl
   precision mediump float;
   uniform sampler2D u_texture;
   varying vec2 v_texCoord;

   void main() {
     vec4 color = texture2D(u_texture, v_texCoord);
     // Pure magenta keying with tight threshold to preserve warm interior ambers and reds
     if (color.r > 0.95 && color.g < 0.05 && color.b > 0.95) {
       discard;
     }
     gl_FragColor = color;
   }
   ```

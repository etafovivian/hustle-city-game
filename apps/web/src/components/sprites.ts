// Where to draw a map sprite: each image keeps its own shape (towers are tall, terminals wide).
import { ART_SIZE } from "./artSizes.js";
import { BASE } from "./cityLayout.js";

/**
 * Image box for a building whose foot point is (x, y). The art is `BASE * scale` wide; its plot diamond is as wide
 * as the art, and the plot's bottom tip sits `width / 12` below the foot point (see siteOf in cityLayout).
 */
export function buildingBox(art: string, x: number, y: number, scale = 1) {
  const [pw, ph] = ART_SIZE[art] ?? [720, 680];
  const w = BASE * scale;
  const h = (w * ph) / pw;
  return { x: x - w / 2, y: y + w / 12 - h, w, h };
}

/** Image box for a prop `w` wide standing on (x, y). */
export function propBox(art: string, x: number, y: number, w: number) {
  const [pw, ph] = ART_SIZE[art] ?? [w, w];
  const h = (w * ph) / pw;
  return { x: x - w / 2, y: y - h, w, h };
}

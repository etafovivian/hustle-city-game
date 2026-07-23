import { describe, expect, it } from "vitest";
import { APPEAL, SHOP_FLOOR, appealOf, demandBoost, footprint, placementProblem } from "./decor.js";
import { settleShop } from "./economy.js";

describe("placements", () => {
  it("swaps the footprint on odd rotations", () => {
    expect(footprint({ itemKey: "generator", x: 0, y: 0, rotation: 0 })).toMatchObject({ w: 2, h: 1 });
    expect(footprint({ itemKey: "generator", x: 0, y: 0, rotation: 1 })).toMatchObject({ w: 1, h: 2 });
  });

  it("rejects out-of-bounds, overlapping and unknown placements", () => {
    expect(placementProblem({ itemKey: "plastic_chair", x: 0, y: 0, rotation: 0 }, [])).toBeNull();
    expect(placementProblem({ itemKey: "generator", x: SHOP_FLOOR.cols - 1, y: 0, rotation: 0 }, [])).toMatch(/fit/);
    expect(placementProblem({ itemKey: "plastic_chair", x: 1, y: 0, rotation: 0 }, [{ itemKey: "generator", x: 0, y: 0, rotation: 0 }])).toMatch(/already/);
    expect(placementProblem({ itemKey: "gold_throne", x: 0, y: 0, rotation: 0 }, [])).toMatch(/Unknown/);
    expect(placementProblem({ itemKey: "plastic_chair", x: 0, y: 0, rotation: 4 }, [])).toMatch(/Rotation/);
  });
});

describe("appeal", () => {
  it("adds up and caps the demand boost", () => {
    expect(appealOf([{ itemKey: "standing_fan", x: 0, y: 0, rotation: 0 }, { itemKey: "plastic_chair", x: 1, y: 0, rotation: 0 }])).toBe(3);
    expect(demandBoost(3)).toBeCloseTo(0.03);
    expect(demandBoost(1000)).toBe(APPEAL.maxBoost);
  });

  it("a boost never lowers sales", () => {
    const inv = [{ itemKey: "pure_water", quantity: 500, price: 50 }];
    const plain = settleShop("s", inv, 0, 100).totalUnits;
    const boosted = settleShop("s", inv, 0, 100, 0.2).totalUnits;
    expect(boosted).toBeGreaterThanOrEqual(plain);
  });
});

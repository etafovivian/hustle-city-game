import { describe, expect, it } from "vitest";
import { PLOT_ID, landPrice, plotSquareMetres } from "./land.js";

describe("land", () => {
  it("prices the Island above the mainland and a big road above a close", () => {
    expect(landPrice("Island Heights", "local", 54)).toBeGreaterThan(landPrice("Danfo Terminal", "local", 54));
    expect(landPrice("Lekki Gardens", "arterial", 54)).toBeGreaterThan(landPrice("Lekki Gardens", "alley", 54));
    expect(plotSquareMetres(38)).toBeGreaterThan(250);
  });
  it("accepts map plot ids only", () => {
    expect(PLOT_ID.test("lekki-gardens-c2+12")).toBe(true);
    expect(PLOT_ID.test("../etc")).toBe(false);
  });
});

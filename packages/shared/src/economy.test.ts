import { describe, expect, it } from "vitest";
import { ECONOMY, STOCK_ITEMS_BY_KEY, customerOrderFor, expectedDemand, isValidPrice, settleShop } from "./economy.js";

const water = STOCK_ITEMS_BY_KEY.get("pure_water")!;

describe("expectedDemand", () => {
  it("equals base demand at the reference price", () => {
    expect(expectedDemand(water, water.referencePrice)).toBeCloseTo(water.baseDemandPerStep);
  });
  it("falls as price rises and is capped when price falls", () => {
    expect(expectedDemand(water, water.referencePrice * 2)).toBeLessThan(water.baseDemandPerStep);
    expect(expectedDemand(water, 1)).toBe(water.baseDemandPerStep * ECONOMY.maxDemandMultiplier);
  });
});

describe("isValidPrice", () => {
  it("rejects non-integers and out-of-range prices", () => {
    expect(isValidPrice(water, 50)).toBe(true);
    expect(isValidPrice(water, 50.5)).toBe(false);
    expect(isValidPrice(water, 0)).toBe(false);
    expect(isValidPrice(water, water.referencePrice * 6)).toBe(false);
  });
});

describe("settleShop", () => {
  const inventory = [{ itemKey: "pure_water", quantity: 100, price: 50 }];

  it("is deterministic for the same window", () => {
    expect(settleShop("shop-1", inventory, 1000, 1012)).toEqual(settleShop("shop-1", inventory, 1000, 1012));
  });

  it("never sells more than stock", () => {
    const r = settleShop("shop-1", [{ itemKey: "pure_water", quantity: 5, price: 1 }], 0, 50);
    expect(r.totalUnits).toBe(5);
  });

  it("caps offline accrual at maxStepsPerSettle", () => {
    const r = settleShop("shop-1", inventory, 0, 10_000);
    expect(r.stepsSimulated).toBe(ECONOMY.maxStepsPerSettle);
    expect(r.settledToStep).toBe(10_000);
  });

  it("does nothing for an empty or reversed window", () => {
    expect(settleShop("shop-1", inventory, 50, 50).totalUnits).toBe(0);
    expect(settleShop("shop-1", inventory, 60, 50).settledToStep).toBe(60);
  });

  it("splitting a window gives the same total as settling at once", () => {
    const whole = settleShop("shop-x", inventory, 0, 20);
    const first = settleShop("shop-x", inventory, 0, 10);
    const rest = settleShop(
      "shop-x",
      [{ itemKey: "pure_water", quantity: 100 - first.totalUnits, price: 50 }],
      10,
      20,
    );
    expect(first.totalUnits + rest.totalUnits).toBe(whole.totalUnits);
  });
});

describe("customerOrderFor", () => {
  it("is stable per slot and pays above reference", () => {
    const a = customerOrderFor("shop-1", 42);
    expect(customerOrderFor("shop-1", 42)).toEqual(a);
    const item = STOCK_ITEMS_BY_KEY.get(a.itemKey)!;
    expect(a.offer).toBeGreaterThan(a.units * item.referencePrice);
  });
});

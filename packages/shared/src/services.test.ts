import { describe, expect, it } from "vitest";
import { availableActions, nextStatus, quoteProblem, quoteTotal, waitingOn } from "./services.js";

const now = new Date("2026-10-12T10:00:00Z");
const tomorrow = new Date("2026-10-13T10:00:00Z");

describe("service request states", () => {
  it("walks the happy path", () => {
    expect(nextStatus("requested", "quote", "artisan")).toBe("quoted");
    expect(nextStatus("quoted", "accept", "customer")).toBe("scheduled");
    expect(nextStatus("scheduled", "complete", "artisan")).toBe("completion_submitted");
    expect(nextStatus("completion_submitted", "confirm", "customer")).toBe("completed");
    expect(nextStatus("completed", "review", "customer")).toBe("completed");
  });

  it("keeps each step with the right party", () => {
    expect(nextStatus("requested", "quote", "customer")).toBeNull();
    expect(nextStatus("quoted", "accept", "artisan")).toBeNull();
    expect(nextStatus("completion_submitted", "confirm", "artisan")).toBeNull();
    expect(nextStatus("completed", "review", "artisan")).toBeNull();
  });

  it("sends extra charges after booking back to the customer", () => {
    expect(nextStatus("scheduled", "quote", "artisan")).toBe("quoted");
    expect(waitingOn("quoted")).toBe("customer");
  });

  it("lets the customer reopen a job marked done too early", () => {
    expect(nextStatus("completion_submitted", "not_done", "customer")).toBe("scheduled");
  });

  it("closes finished requests to everything but a single review", () => {
    for (const a of ["quote", "accept", "cancel", "note"] as const) expect(nextStatus("completed", a, "customer")).toBeNull();
    expect(availableActions("completed", "customer", false)).toEqual(["review"]);
    expect(availableActions("completed", "customer", true)).toEqual([]);
    expect(availableActions("declined", "artisan", false)).toEqual([]);
  });

  it("lets the artisan turn a request down only before quoting", () => {
    expect(nextStatus("requested", "decline", "artisan")).toBe("declined");
    expect(nextStatus("quoted", "decline", "artisan")).toBeNull();
  });
});

describe("quotes", () => {
  const items = [
    { label: "Call-out", amountKobo: 1_000_000 },
    { label: "Carburettor clean", amountKobo: 750_000 },
  ];
  it("totals in kobo", () => expect(quoteTotal(items)).toBe(1_750_000));
  it("accepts a valid quote", () => expect(quoteProblem(items, tomorrow, now)).toBeNull());
  it("rejects empty, fractional, negative and huge lines", () => {
    expect(quoteProblem([], tomorrow, now)).toBeTruthy();
    expect(quoteProblem([{ label: "x", amountKobo: 100 }], tomorrow, now)).toBeTruthy();
    expect(quoteProblem([{ label: "Parts", amountKobo: 10.5 }], tomorrow, now)).toBeTruthy();
    expect(quoteProblem([{ label: "Parts", amountKobo: -1 }], tomorrow, now)).toBeTruthy();
    expect(quoteProblem([{ label: "Parts", amountKobo: 600_000_000 }], tomorrow, now)).toBeTruthy();
  });
  it("needs an appointment in the next 90 days", () => {
    expect(quoteProblem(items, new Date("2026-10-11T10:00:00Z"), now)).toBeTruthy();
    expect(quoteProblem(items, new Date("2027-03-01T10:00:00Z"), now)).toBeTruthy();
    expect(quoteProblem(items, new Date("nope"), now)).toBeTruthy();
  });
});

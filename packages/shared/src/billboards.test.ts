import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adStatus, cleanAdLink, imageInfo } from "./billboards.js";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)));

describe("banner images", () => {
  it.each([
    ["banner-lossy.webp", "image/webp"],
    ["banner-lossless.webp", "image/webp"],
    ["banner-alpha.webp", "image/webp"],
    ["banner.png", "image/png"],
    ["banner.jpg", "image/jpeg"],
  ])("reads %s from its header", (name, type) => {
    expect(imageInfo(fixture(name))).toEqual({ type, width: 1200, height: 400 });
  });
  it("reports the real size of other images", () => expect(imageInfo(fixture("square.png"))).toMatchObject({ width: 800, height: 800 }));
  it("rejects things that aren't images", () => {
    expect(imageInfo(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(imageInfo(new TextEncoder().encode("GIF89a........................"))).toBeNull();
  });
});

describe("ad links", () => {
  it("keeps https links", () => expect(cleanAdLink(" https://wa.me/2348012345678 ")).toBe("https://wa.me/2348012345678"));
  it("rejects http, javascript, credentials and bare words", () => {
    for (const bad of ["http://example.com", "javascript:alert(1)", "https://user:pw@example.com", "https://localhost", "example.com"]) {
      expect(cleanAdLink(bad)).toBeNull();
    }
  });
});

describe("ad status", () => {
  const now = new Date("2026-10-12T10:00:00Z");
  const base = { reviewStatus: "approved", paymentStatus: "paid", startsAt: new Date("2026-10-11T10:00:00Z"), endsAt: new Date("2026-10-18T10:00:00Z") };
  it("is live only when approved, paid and in its window", () => {
    expect(adStatus(base, now)).toBe("live");
    expect(adStatus({ ...base, paymentStatus: "unpaid" }, now)).toBe("awaiting_payment");
    expect(adStatus({ ...base, reviewStatus: "pending" }, now)).toBe("in_review");
    expect(adStatus({ ...base, reviewStatus: "rejected" }, now)).toBe("rejected");
    expect(adStatus({ ...base, endsAt: new Date("2026-10-12T09:00:00Z") }, now)).toBe("ended");
  });
});

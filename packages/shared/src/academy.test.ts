import { describe, expect, it } from "vitest";
import { CERT_NUMBER_RE, certificateNumber, scoreQuiz, youtubeId } from "./academy.js";

describe("youtubeId", () => {
  it("reads the id from every link shape", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
      "dQw4w9WgXcQ",
    ])
      expect(youtubeId(link)).toBe("dQw4w9WgXcQ");
  });
  it("refuses other sites and broken ids", () => {
    expect(youtubeId("https://vimeo.com/123")).toBeNull();
    expect(youtubeId("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(youtubeId("not a link")).toBeNull();
  });
});

describe("scoreQuiz", () => {
  it("counts right answers and the pass mark", () => {
    expect(scoreQuiz([1, 2, 0, null, 3], [1, 2, 0, 1, 3], 70)).toEqual({ right: 4, total: 5, percent: 80, passed: true });
    expect(scoreQuiz([1, 0, 0, 0, 0], [1, 2, 0, 1, 3], 70)).toMatchObject({ percent: 40, passed: false });
  });
});

describe("certificateNumber", () => {
  it("makes numbers the verify page accepts, without look-alike characters", () => {
    let i = 0;
    const n = certificateNumber(2026, (m) => i++ % m);
    expect(n).toMatch(CERT_NUMBER_RE);
    expect(n.startsWith("LIT-26-")).toBe(true);
    expect(n.slice(7)).not.toMatch(/[01ILO]/);
  });
});

import { describe, expect, it } from "vitest";
import { chatProblem } from "./chat.js";

describe("chat", () => {
  it("allows normal talk and blocks links and phone numbers", () => {
    expect(chatProblem("How far? Make we go Skyline tonight")).toBeNull();
    expect(chatProblem("")).not.toBeNull();
    expect(chatProblem("check www.free-money.xyz")).toMatch(/Links/);
    expect(chatProblem("call me 0803 123 4567")).toMatch(/Phone/);
    expect(chatProblem("my num +2348031234567")).toMatch(/Phone/);
    expect(chatProblem("I scored 3 goals")).toBeNull();
  });
});

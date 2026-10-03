import { describe, expect, it } from "vitest";
import { parseNumber } from "./number";

describe("parseNumber", () => {
  it("부호·천 단위 쉼표·소수·퍼센트를 읽는다", () => {
    expect(parseNumber("1,234")).toBe(1234);
    expect(parseNumber("-5.5")).toBe(-5.5);
    expect(parseNumber(" +.5 ")).toBe(0.5);
    expect(parseNumber("50%")).toBe(0.5);
    expect(parseNumber("1234567")).toBe(1234567);
  });

  it("숫자가 없거나 표에서 쓰지 않는 표기는 글자다", () => {
    for (const t of ["", "-", "%", "-%", "abc", "1,23", "12,3456", "1e3", "0x10", "Infinity", "1.2.3"]) {
      expect(parseNumber(t)).toBeNull();
    }
  });
});

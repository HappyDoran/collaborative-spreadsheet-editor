import { describe, expect, it } from "vitest";
import { PARTICIPANT_COLORS, initialOf, normalizeName, pickColor } from "./participants";

describe("participants", () => {
  it("팔레트는 서로 다른 10색", () => {
    expect(new Set(PARTICIPANT_COLORS).size).toBe(10);
  });

  it("쓰이지 않은 색만 고른다 (대소문자 무시)", () => {
    const used = PARTICIPANT_COLORS.slice(0, 9).map((c) => c.toLowerCase());
    for (const r of [0, 0.5, 0.99]) expect(pickColor(used, () => r)).toBe(PARTICIPANT_COLORS[9]);
  });

  it("전부 쓰였으면 전체에서 고른다", () => {
    expect(PARTICIPANT_COLORS).toContain(pickColor(PARTICIPANT_COLORS, () => 0.3));
  });

  it("이름 정규화: 공백 정리, 최대 20자, 빈 값은 null", () => {
    expect(normalizeName("  김   철수 ")).toBe("김 철수");
    expect(normalizeName("가".repeat(25))).toBe("가".repeat(20));
    expect(normalizeName("   ")).toBeNull();
  });

  it("첫 글자: 한글·영문 소문자·이모지", () => {
    expect(initialOf("서연")).toBe("서");
    expect(initialOf("alex")).toBe("A");
    expect(initialOf("🐳 whale")).toBe("🐳");
  });
});

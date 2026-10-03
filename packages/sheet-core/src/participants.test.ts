import { describe, expect, it } from "vitest";
import { NAME_MAX_LENGTH, PARTICIPANT_COLORS, initialOf, normalizeName, pickColor, suggestName } from "./participants";

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

describe("suggestName", () => {
  it("접속 중이 아니면 그대로, 접속 중이면 비어 있는 번호를 붙인다", () => {
    expect(suggestName("민지", ["준호"])).toBe("민지");
    expect(suggestName("민지", ["민지"])).toBe("민지 2");
    expect(suggestName("민지", ["민지", "민지 2"])).toBe("민지 3");
    expect(suggestName("", ["민지"])).toBe("");
  });

  it("마지막 이름에 이미 번호가 있으면 번호를 겹쳐 붙이지 않고 다음 번호로", () => {
    expect(suggestName("민지 2", ["민지", "민지 2"])).toBe("민지 3");
    expect(suggestName("민지 2", ["민지 2"])).toBe("민지 3");
    expect(suggestName("민지 2", ["민지"])).toBe("민지 2"); // 접속 중이 아니면 그대로
  });

  it("번호를 붙여도 이름 길이 상한을 넘지 않는다", () => {
    const long = "가".repeat(NAME_MAX_LENGTH);
    expect(Array.from(suggestName(long, [long]))).toHaveLength(NAME_MAX_LENGTH);
  });
});

import { describe, expect, it } from "vitest";
import { colToLabel, labelToCol, normalizeRange, parseA1, toA1 } from "./address";

describe("address", () => {
  it("열 번호와 라벨을 26진 경계에서 왕복 변환한다", () => {
    for (const [col, label] of [[0, "A"], [25, "Z"], [26, "AA"], [51, "AZ"], [52, "BA"], [701, "ZZ"], [702, "AAA"]] as const) {
      expect(colToLabel(col)).toBe(label);
      expect(labelToCol(label)).toBe(col);
    }
  });

  it("A1 표기를 0 기준 좌표로 파싱하고 되돌린다", () => {
    expect(parseA1("b3")).toEqual({ row: 2, col: 1 });
    expect(toA1({ row: 2, col: 1 })).toBe("B3");
  });

  it("잘못된 A1 표기는 null", () => {
    for (const bad of ["", "A0", "1A", "A-1", "A1:B2"]) expect(parseA1(bad)).toBeNull();
  });

  it("역방향 드래그 범위를 좌상단-우하단으로 정규화한다", () => {
    expect(normalizeRange({ row: 4, col: 3 }, { row: 1, col: 5 })).toEqual({
      start: { row: 1, col: 3 },
      end: { row: 4, col: 5 },
    });
  });
});

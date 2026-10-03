import { describe, expect, it } from "vitest";
import { judgeEdit, scopesOverlap, staleEdits } from "./proposal";

const scope = { start: { row: 1, col: 1 }, end: { row: 3, col: 2 } }; // B2:C4
const values: Record<string, string> = { "1:1": "100" };
const read = ({ row, col }: { row: number; col: number }) => values[`${row}:${col}`] ?? "";

describe("judgeEdit", () => {
  it("대상 안의 셀은 원래 값과 함께 제안으로 받는다", () => {
    expect(judgeEdit("b2", "110", scope, read)).toEqual({
      ok: true,
      edit: { addr: { row: 1, col: 1 }, before: "100", after: "110" },
    });
  });

  it("대상 밖·시트 밖은 outside, 주소가 아니면 invalid", () => {
    expect(judgeEdit("D2", "x", scope, read)).toEqual({ ok: false, reason: "outside" });
    expect(judgeEdit("A1", "x", null, read)).toMatchObject({ ok: true });
    expect(judgeEdit("AA1", "x", null, read)).toEqual({ ok: false, reason: "outside" });
    expect(judgeEdit("A101", "x", null, read)).toEqual({ ok: false, reason: "outside" });
    for (const bad of ["", "합계", "B2:C3", "2B"]) expect(judgeEdit(bad, "x", null, read)).toEqual({ ok: false, reason: "invalid" });
  });

  it("값이 그대로면 제안이 아니다", () => {
    expect(judgeEdit("B2", "100", scope, read)).toEqual({ ok: false, reason: "unchanged" });
  });
});

describe("staleEdits", () => {
  it("검토 중 원래 값이 바뀐 제안만 고른다", () => {
    const edits = [
      { addr: { row: 1, col: 1 }, before: "100", after: "110" },
      { addr: { row: 2, col: 1 }, before: "50", after: "55" },
    ];
    expect(staleEdits(edits, read)).toEqual([edits[1]]);
  });
});

describe("scopesOverlap", () => {
  const r = (r1: number, c1: number, r2: number, c2: number) => ({ start: { row: r1, col: c1 }, end: { row: r2, col: c2 } });
  it("한 칸이라도 겹치면 true, 모서리만 닿지 않으면 false", () => {
    expect(scopesOverlap(r(1, 1, 3, 3), r(3, 3, 5, 5))).toBe(true);
    expect(scopesOverlap(r(1, 1, 3, 3), r(4, 1, 5, 3))).toBe(false);
    expect(scopesOverlap(r(1, 1, 3, 3), r(1, 4, 3, 5))).toBe(false);
  });

  it("시트 전체(null)는 무엇과도 겹친다", () => {
    expect(scopesOverlap(null, r(9, 9, 9, 9))).toBe(true);
    expect(scopesOverlap(r(0, 0, 0, 0), null)).toBe(true);
  });
});


import { describe, expect, it } from "vitest";
import { judgeEdit, staleEdits } from "./proposal";

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

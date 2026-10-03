import { describe, expect, it } from "vitest";
import { AI_CONTEXT_MAX_CELLS, sheetContext } from "./context";

describe("sheetContext", () => {
  it("값이 있는 셀만, 대상 범위 안을 먼저, 값은 JSON 문자열로", () => {
    const values: Record<string, string> = { "0:0": "제목", "5:1": 'a "b"\nc' };
    const read = ({ row, col }: { row: number; col: number }) => values[`${row}:${col}`] ?? "";
    const scope = { start: { row: 5, col: 1 }, end: { row: 5, col: 1 } };
    expect(sheetContext(read, scope)).toEqual({ text: 'B6: "a \\"b\\"\\nc"\nA1: "제목"', truncated: false });
  });

  it("상한을 넘으면 자르고 truncated", () => {
    const { text, truncated } = sheetContext(() => "x", null);
    expect(text.split("\n")).toHaveLength(AI_CONTEXT_MAX_CELLS);
    expect(truncated).toBe(true);
  });
});

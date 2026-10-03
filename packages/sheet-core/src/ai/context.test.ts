import { describe, expect, it } from "vitest";
import { AI_CONTEXT_MAX_CELLS, AI_HISTORY_TURNS, AI_TURN_MAX_CHARS, recentTurns, sheetContext } from "./context";

describe("sheetContext", () => {
  it("값이 있는 셀만, 대상 범위 안을 먼저, 값은 JSON 문자열로", () => {
    const values: Record<string, string> = { "0:0": "제목", "5:1": 'a "b"\nc' };
    const read = ({ row, col }: { row: number; col: number }) => values[`${row}:${col}`] ?? "";
    const scope = { start: { row: 5, col: 1 }, end: { row: 5, col: 1 } };
    expect(sheetContext(read, scope)).toBe('B6: "a \\"b\\"\\nc"\nA1: "제목"');
  });

  it("상한을 넘으면 자른다", () => {
    expect(sheetContext(() => "x", null).split("\n")).toHaveLength(AI_CONTEXT_MAX_CELLS);
  });
});

describe("recentTurns", () => {
  it("최근 턴만, 턴마다 길이 상한까지 남긴다", () => {
    const many = Array.from({ length: AI_HISTORY_TURNS + 2 }, (_, i) => ({ role: i % 2 ? "ai" : "user", text: `t${i}` }));
    expect(recentTurns(many)?.map((t) => t.text)).toEqual(many.slice(-AI_HISTORY_TURNS).map((t) => t.text));
    expect(recentTurns([{ role: "user", text: "가".repeat(AI_TURN_MAX_CHARS + 10) }])?.[0]?.text).toHaveLength(AI_TURN_MAX_CHARS);
    expect(recentTurns(undefined)).toEqual([]);
  });

  it("형식이 틀리면 null", () => {
    for (const bad of [null, "x", [{ role: "system", text: "x" }], [{ role: "user", text: 1 }], [null]]) {
      expect(recentTurns(bad)).toBeNull();
    }
  });
});

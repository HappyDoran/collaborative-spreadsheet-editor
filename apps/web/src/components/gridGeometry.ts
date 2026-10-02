import type { CellAddress, CellRange } from "@sheet/core";

// 셀 크기 고정 — 선택 테두리 위치가 곱셈 하나로 정해진다 (DESIGN.md 9절).
export const COL_W = 104;
export const ROW_H = 26;
export const HEADER_W = 52;

export const rectOf = (range: CellRange) => ({
  top: ROW_H + range.start.row * ROW_H,
  left: HEADER_W + range.start.col * COL_W,
  width: (range.end.col - range.start.col + 1) * COL_W,
  height: (range.end.row - range.start.row + 1) * ROW_H,
});

export const single = (addr: CellAddress): CellRange => ({ start: addr, end: addr });

import type { CellAddress, CellRange } from "@sheet/core";

// 열 너비는 고정, 행 높이는 그 행에서 가장 줄이 많은 칸에 맞춘다 — 엑셀의 행 높이 자동 맞춤 (DESIGN.md 9절).
export const COL_W = 104;
export const HEADER_W = 52;
export const LINE_H = 18;
export const rowHeight = (lines: number) => lines * LINE_H + 8;
export const ROW_H = rowHeight(1);

export const lineCount = (value: string) => value.split("\n").length;

// 겹쳐 그리는 표시(선택·제안·다른 참여자)는 픽셀이 아니라 그리드 칸 번호로 놓는다 — 행 높이가 바뀌어도 따라간다.
// 그리드 안의 absolute 요소는 지정한 칸 영역이 기준 상자가 된다. 머리글이 1행·1열이라 +2.
export const areaOf = (range: CellRange) => ({
  gridRow: `${range.start.row + 2} / ${range.end.row + 3}`,
  gridColumn: `${range.start.col + 2} / ${range.end.col + 3}`,
  inset: 0,
});

export const single = (addr: CellAddress): CellRange => ({ start: addr, end: addr });

import * as Y from "yjs";
import type { CellAddress, CellRange } from "./address";

// 스키마: 필드마다 최상위 맵 하나 — doc.getMap("value" | "bold" | "italic" | "underline"), 키는 "행:열".
// 칸·필드마다 독립된 항목이라, 빈 칸에 두 탭이 동시에 값과 서식을 써도, 한쪽이 되돌려도 다른 필드는 남는다
// (DESIGN.md 8절). 셀마다 중첩 맵을 만들면 빈 칸을 동시에 만들 때 한쪽 맵이 통째로 사라진다.
export const SHEET_ROWS = 100;
export const SHEET_COLS = 26;

export const FORMATS = ["bold", "italic", "underline"] as const;
export type CellFormat = (typeof FORMATS)[number];
export type CellData = { value: string } & Partial<Record<CellFormat, boolean>>;

export const CELL_FIELDS = ["value", ...FORMATS] as const;
type CellField = (typeof CELL_FIELDS)[number];

const fieldMap = (doc: Y.Doc, field: CellField) => doc.getMap<string | boolean>(field);

// 셀 데이터가 든 맵 전부. 실행 취소 범위와 변경 구독이 이것을 쓴다.
export function cellMaps(doc: Y.Doc): Y.Map<string | boolean>[] {
  return CELL_FIELDS.map((f) => fieldMap(doc, f));
}

// 셀 데이터가 바뀌면 fn을 부른다. 구독 해제 함수를 돌려준다.
export function observeCells(doc: Y.Doc, fn: () => void): () => void {
  const maps = cellMaps(doc);
  maps.forEach((m) => m.observe(fn));
  return () => maps.forEach((m) => m.unobserve(fn));
}

export function cellKey({ row, col }: CellAddress): string {
  return `${row}:${col}`;
}

export function isInsideSheet({ row, col }: CellAddress): boolean {
  return row >= 0 && row < SHEET_ROWS && col >= 0 && col < SHEET_COLS;
}

export function forEachAddress(range: CellRange, fn: (addr: CellAddress) => void): void {
  for (let row = range.start.row; row <= range.end.row; row++) {
    for (let col = range.start.col; col <= range.end.col; col++) fn({ row, col });
  }
}

// 값도 서식도 없는 칸은 undefined.
export function readCell(doc: Y.Doc, addr: CellAddress): CellData | undefined {
  const key = cellKey(addr);
  const value = fieldMap(doc, "value").get(key) as string | undefined;
  const cell: CellData = { value: value ?? "" };
  for (const f of FORMATS) if (fieldMap(doc, f).get(key)) cell[f] = true;
  return value === undefined && !FORMATS.some((f) => cell[f]) ? undefined : cell;
}

// 필드별로 쓴다. 빈 값·꺼진 서식은 키를 지워 문서가 쓰레기 키로 커지지 않게 하고, 같은 값은 다시 쓰지 않는다.
function patchCell(doc: Y.Doc, addr: CellAddress, patch: Partial<CellData>): void {
  const key = cellKey(addr);
  for (const [field, v] of Object.entries(patch) as [CellField, string | boolean | undefined][]) {
    if (v === undefined) continue;
    const m = fieldMap(doc, field);
    if (v === "" || v === false) {
      if (m.has(key)) m.delete(key);
    } else if (m.get(key) !== v) m.set(key, v);
  }
}

export function setCellValue(doc: Y.Doc, addr: CellAddress, value: string, origin: unknown): void {
  doc.transact(() => patchCell(doc, addr, { value }), origin);
}

// 내용만 지우고 서식은 남긴다 (엑셀 Delete 동작).
export function clearValues(doc: Y.Doc, range: CellRange, origin: unknown): void {
  doc.transact(() => forEachAddress(range, (addr) => patchCell(doc, addr, { value: "" })), origin);
}

// 서식만 지우고 값은 남긴다 (엑셀·시트의 "서식 지우기").
export function clearFormats(doc: Y.Doc, range: CellRange, origin: unknown): void {
  const off = Object.fromEntries(FORMATS.map((f) => [f, false]));
  doc.transact(() => forEachAddress(range, (addr) => patchCell(doc, addr, off)), origin);
}

// 범위가 전부 켜져 있으면 끄고, 아니면 전부 켠다 (엑셀 동작).
export function toggleFormat(doc: Y.Doc, range: CellRange, format: CellFormat, origin: unknown): void {
  let allOn = true;
  forEachAddress(range, (addr) => {
    if (!readCell(doc, addr)?.[format]) allOn = false;
  });
  doc.transact(() => forEachAddress(range, (addr) => patchCell(doc, addr, { [format]: !allOn })), origin);
}

export function readGrid(doc: Y.Doc, range: CellRange): CellData[][] {
  const grid: CellData[][] = [];
  for (let row = range.start.row; row <= range.end.row; row++) {
    const line: CellData[] = [];
    for (let col = range.start.col; col <= range.end.col; col++) line.push(readCell(doc, { row, col }) ?? { value: "" });
    grid.push(line);
  }
  return grid;
}

// 선택하여 붙여넣기 (DESIGN.md 14절): 전부 / 값만 / 서식만
export type PasteMode = "all" | "values" | "formats";

// 붙여넣기. 값 하나를 범위에 붙이면 범위를 채우고, 그 외에는 target 좌상단부터 쓰고 시트 밖은 버린다.
// 서식은 원본 그대로 덮어쓴다 (원본에 없으면 끈다). mode로 값만·서식만 고를 수 있다. 쓴 범위를 돌려준다.
export function writeGrid(
  doc: Y.Doc,
  target: CellRange,
  grid: CellData[][],
  origin: unknown,
  mode: PasteMode = "all",
): CellRange | null {
  const first = grid[0]?.[0];
  if (!first) return null;
  const single = grid.length === 1 && grid[0]!.length === 1;
  const rows = single ? target.end.row - target.start.row + 1 : grid.length;
  const cols = single ? target.end.col - target.start.col + 1 : Math.max(...grid.map((r) => r.length));
  const end = {
    row: Math.min(target.start.row + rows - 1, SHEET_ROWS - 1),
    col: Math.min(target.start.col + cols - 1, SHEET_COLS - 1),
  };
  const written = { start: target.start, end };
  doc.transact(() => {
    forEachAddress(written, (addr) => {
      const src = single ? first : grid[addr.row - target.start.row]?.[addr.col - target.start.col];
      const cell = src ?? { value: "" };
      const formats = { bold: !!cell.bold, italic: !!cell.italic, underline: !!cell.underline };
      if (mode === "values") patchCell(doc, addr, { value: cell.value });
      else if (mode === "formats") patchCell(doc, addr, formats);
      else patchCell(doc, addr, { value: cell.value, ...formats });
    });
  }, origin);
  return written;
}

// 여러 셀의 값을 한 번에 쓴다 (AI 제안 적용). transaction 하나 = 실행 취소 한 단계 (A5). 서식은 건드리지 않는다.
export function setValues(doc: Y.Doc, entries: { addr: CellAddress; value: string }[], origin: unknown): void {
  doc.transact(() => entries.forEach(({ addr, value }) => patchCell(doc, addr, { value })), origin);
}

// 내 transaction(origin)만 추적한다 — 원격·영속 계층 update는 되돌리지 않는다 (C7).
// captureTimeout 0: 연속 입력을 한 단계로 합치지 않는다. 사용자 동작 하나 = undo 한 단계.
export function createUndoManager(doc: Y.Doc, origin: unknown): Y.UndoManager {
  return new Y.UndoManager(cellMaps(doc), { trackedOrigins: new Set([origin]), captureTimeout: 0 });
}

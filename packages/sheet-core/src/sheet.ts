import * as Y from "yjs";
import type { CellAddress, CellRange } from "./address";

// 스키마: doc.getMap("cells") 아래 "행:열" 키마다 Y.Map { value, bold, italic, underline }.
// 값과 서식을 칸별로 두어 동시 편집이 칸 단위로 병합된다 (DESIGN.md 8절).
export const SHEET_ROWS = 100;
export const SHEET_COLS = 26;

export const FORMATS = ["bold", "italic", "underline"] as const;
export type CellFormat = (typeof FORMATS)[number];
export type CellData = { value: string } & Partial<Record<CellFormat, boolean>>;

type CellMap = Y.Map<string | boolean>;

export function cellKey({ row, col }: CellAddress): string {
  return `${row}:${col}`;
}

export function getCells(doc: Y.Doc): Y.Map<CellMap> {
  return doc.getMap<CellMap>("cells");
}

export function isInsideSheet({ row, col }: CellAddress): boolean {
  return row >= 0 && row < SHEET_ROWS && col >= 0 && col < SHEET_COLS;
}

export function forEachAddress(range: CellRange, fn: (addr: CellAddress) => void): void {
  for (let row = range.start.row; row <= range.end.row; row++) {
    for (let col = range.start.col; col <= range.end.col; col++) fn({ row, col });
  }
}

export function readCell(doc: Y.Doc, addr: CellAddress): CellData | undefined {
  const m = getCells(doc).get(cellKey(addr));
  if (!m) return undefined;
  const cell: CellData = { value: (m.get("value") as string | undefined) ?? "" };
  for (const f of FORMATS) if (m.get(f)) cell[f] = true;
  return cell;
}

// 빈 값 + 서식 없음이면 셀 맵 자체를 지워 문서가 쓰레기 키로 커지지 않게 한다.
function patchCell(cells: Y.Map<CellMap>, addr: CellAddress, patch: Partial<CellData>): void {
  const key = cellKey(addr);
  let m = cells.get(key);
  if (!m) {
    if (!patch.value && !FORMATS.some((f) => patch[f])) return;
    m = new Y.Map();
    cells.set(key, m);
  }
  for (const [field, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === "" || v === false) m.delete(field);
    else m.set(field, v);
  }
  if (m.size === 0) cells.delete(key);
}

export function setCellValue(doc: Y.Doc, addr: CellAddress, value: string, origin: unknown): void {
  doc.transact(() => patchCell(getCells(doc), addr, { value }), origin);
}

// 내용만 지우고 서식은 남긴다 (엑셀 Delete 동작).
export function clearValues(doc: Y.Doc, range: CellRange, origin: unknown): void {
  const cells = getCells(doc);
  doc.transact(() => forEachAddress(range, (addr) => patchCell(cells, addr, { value: "" })), origin);
}

// 서식만 지우고 값은 남긴다 (엑셀·시트의 "서식 지우기").
export function clearFormats(doc: Y.Doc, range: CellRange, origin: unknown): void {
  const cells = getCells(doc);
  const off = Object.fromEntries(FORMATS.map((f) => [f, false]));
  doc.transact(() => forEachAddress(range, (addr) => patchCell(cells, addr, off)), origin);
}

// 범위가 전부 켜져 있으면 끄고, 아니면 전부 켠다 (엑셀 동작).
export function toggleFormat(doc: Y.Doc, range: CellRange, format: CellFormat, origin: unknown): void {
  let allOn = true;
  forEachAddress(range, (addr) => {
    if (!readCell(doc, addr)?.[format]) allOn = false;
  });
  const cells = getCells(doc);
  doc.transact(() => forEachAddress(range, (addr) => patchCell(cells, addr, { [format]: !allOn })), origin);
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
  const cells = getCells(doc);
  doc.transact(() => {
    forEachAddress(written, (addr) => {
      const src = single ? first : grid[addr.row - target.start.row]?.[addr.col - target.start.col];
      const cell = src ?? { value: "" };
      const formats = { bold: !!cell.bold, italic: !!cell.italic, underline: !!cell.underline };
      if (mode === "values") patchCell(cells, addr, { value: cell.value });
      else if (mode === "formats") patchCell(cells, addr, formats);
      else patchCell(cells, addr, { value: cell.value, ...formats });
    });
  }, origin);
  return written;
}

// 여러 셀의 값을 한 번에 쓴다 (AI 제안 적용). transaction 하나 = 실행 취소 한 단계 (A5). 서식은 건드리지 않는다.
export function setValues(doc: Y.Doc, entries: { addr: CellAddress; value: string }[], origin: unknown): void {
  const cells = getCells(doc);
  doc.transact(() => entries.forEach(({ addr, value }) => patchCell(cells, addr, { value })), origin);
}

// 내 transaction(origin)만 추적한다 — 원격·영속 계층 update는 되돌리지 않는다 (C7).
// captureTimeout 0: 연속 입력을 한 단계로 합치지 않는다. 사용자 동작 하나 = undo 한 단계.
export function createUndoManager(doc: Y.Doc, origin: unknown): Y.UndoManager {
  return new Y.UndoManager(getCells(doc), { trackedOrigins: new Set([origin]), captureTimeout: 0 });
}

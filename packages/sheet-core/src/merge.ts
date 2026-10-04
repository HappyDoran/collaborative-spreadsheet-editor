import type * as Y from "yjs";
import type { CellAddress, CellRange } from "./address";
import { SHEET_COLS, SHEET_ROWS, cellKey, forEachAddress, mergeMap, readCell, setCellValue, writeGrid, type CellData, type PasteMode } from "./sheet";

// 셀 병합 (DESIGN.md 8절). 문서에는 doc.getMap("merge")에 왼쪽 위 칸 키 → 오른쪽 아래 칸 키로 둔다.
// 두 탭이 동시에 겹치는 범위를 병합하면 둘 다 문서에 남는다 — 읽을 때 위·왼쪽 병합부터 받아 겹치는 것은 버린다.
// 모든 탭이 같은 규칙으로 고르므로 같은 결과를 그린다.

const parseKey = (key: string): CellAddress | null => {
  const [row, col] = key.split(":").map(Number);
  return Number.isInteger(row) && Number.isInteger(col) ? { row: row!, col: col! } : null;
};

export function intersects(a: CellRange, b: CellRange): boolean {
  return a.start.row <= b.end.row && b.start.row <= a.end.row && a.start.col <= b.end.col && b.start.col <= a.end.col;
}

const sameRange = (a: CellRange, b: CellRange) =>
  a.start.row === b.start.row && a.start.col === b.start.col && a.end.row === b.end.row && a.end.col === b.end.col;

// 문서에 남은 병합 항목 전부 (겹침 정리 전). 지울 때는 이것을 본다 — 겹쳐서 가려진 항목도 함께 지운다.
function rawMerges(doc: Y.Doc): CellRange[] {
  const out: CellRange[] = [];
  mergeMap(doc).forEach((endKey, startKey) => {
    const start = parseKey(startKey);
    const end = typeof endKey === "string" ? parseKey(endKey) : null;
    if (!start || !end) return;
    const valid = start.row >= 0 && start.col >= 0 && end.row < SHEET_ROWS && end.col < SHEET_COLS;
    if (valid && end.row >= start.row && end.col >= start.col && (end.row > start.row || end.col > start.col)) {
      out.push({ start, end });
    }
  });
  return out;
}

// 화면·연산이 쓰는 병합 목록. 위·왼쪽부터 받아 앞서 받은 것과 겹치는 항목은 버린다.
export function readMerges(doc: Y.Doc): CellRange[] {
  const sorted = rawMerges(doc).sort((a, b) => a.start.row - b.start.row || a.start.col - b.start.col);
  const out: CellRange[] = [];
  for (const m of sorted) if (!out.some((kept) => intersects(kept, m))) out.push(m);
  return out;
}

export function mergeAt(merges: CellRange[], addr: CellAddress): CellRange | undefined {
  return merges.find((m) => addr.row >= m.start.row && addr.row <= m.end.row && addr.col >= m.start.col && addr.col <= m.end.col);
}

// 병합에 가려진 칸 (왼쪽 위가 아닌 칸)
export function isCovered(merges: CellRange[], addr: CellAddress): boolean {
  const m = mergeAt(merges, addr);
  return !!m && (m.start.row !== addr.row || m.start.col !== addr.col);
}

// 칸이 병합 안이면 병합의 왼쪽 위 — 엑셀은 병합 칸의 주소를 왼쪽 위로 쓴다
export function anchorOf(merges: CellRange[], addr: CellAddress): CellAddress {
  return mergeAt(merges, addr)?.start ?? addr;
}

// 범위가 걸친 병합을 모두 품도록 넓힌다 (엑셀: 병합 칸 일부만 고를 수 없다). 넓힌 범위가 새 병합에 걸칠 수 있어 반복한다.
export function expandToMerges(range: CellRange, merges: CellRange[]): CellRange {
  let out = range;
  for (let changed = true; changed; ) {
    changed = false;
    for (const m of merges) {
      if (!intersects(out, m)) continue;
      const next = {
        start: { row: Math.min(out.start.row, m.start.row), col: Math.min(out.start.col, m.start.col) },
        end: { row: Math.max(out.end.row, m.end.row), col: Math.max(out.end.col, m.end.col) },
      };
      if (!sameRange(next, out)) {
        out = next;
        changed = true;
      }
    }
  }
  return out;
}

// 범위가 병합 하나와 같으면 한 칸으로 본다 (이름 상자에 왼쪽 위 주소, 선택 배경 없음)
export function isOneCell(range: CellRange, merges: CellRange[]): boolean {
  return (range.start.row === range.end.row && range.start.col === range.end.col) || merges.some((m) => sameRange(m, range));
}

// 방향키·Enter·Tab 한 칸 이동. 병합 안에서 출발하면 병합 가장자리 너머로, 병합에 들어가면 그 왼쪽 위에 선다.
// 시트 끝에서는 움직이지 않는다.
export function stepCell(addr: CellAddress, dRow: number, dCol: number, merges: CellRange[]): CellAddress {
  const from = mergeAt(merges, addr) ?? { start: addr, end: addr };
  const row = dRow > 0 ? from.end.row + dRow : dRow < 0 ? from.start.row + dRow : addr.row;
  const col = dCol > 0 ? from.end.col + dCol : dCol < 0 ? from.start.col + dCol : addr.col;
  if (row < 0 || row >= SHEET_ROWS || col < 0 || col >= SHEET_COLS) return anchorOf(merges, addr);
  return anchorOf(merges, { row, col });
}

// 왼쪽 위 말고도 값이 든 칸이 있는가 — 병합하면 지워지므로 먼저 확인을 받는다 (엑셀)
export function mergeLosesValues(doc: Y.Doc, range: CellRange): boolean {
  let lost = false;
  forEachAddress(range, (addr) => {
    if ((addr.row !== range.start.row || addr.col !== range.start.col) && readCell(doc, addr)?.value) lost = true;
  });
  return lost;
}

// 병합: 걸친 병합을 흡수하고, 왼쪽 위 말고는 값을 지운다(서식은 둔다). 실행 취소 한 단계.
export function mergeCells(doc: Y.Doc, range: CellRange, origin: unknown): void {
  if (range.start.row === range.end.row && range.start.col === range.end.col) return;
  doc.transact(() => {
    for (const m of rawMerges(doc)) if (intersects(m, range)) unsetMerge(doc, m);
    forEachAddress(range, (addr) => {
      if (addr.row === range.start.row && addr.col === range.start.col) return;
      if (readCell(doc, addr)?.value) setCellValue(doc, addr, "", origin); // 같은 transaction에 합쳐진다
    });
    setMerge(doc, range);
  }, origin);
}

// 병합 해제: 범위에 걸친 병합을 모두 푼다. 값은 왼쪽 위 칸에 그대로 남는다.
export function unmergeCells(doc: Y.Doc, range: CellRange, origin: unknown): void {
  doc.transact(() => {
    for (const m of rawMerges(doc)) if (intersects(m, range)) unsetMerge(doc, m);
  }, origin);
}

// 붙여넣기 + 병합 (DESIGN.md 7절). merges는 grid 안 좌표(0 기준). 값만 붙여넣기는 병합을 건드리지 않고,
// 그 밖에는 쓴 범위에 걸친 병합을 풀고 원본의 병합을 놓는다 — 쓴 범위를 벗어나는 병합(시트 밖으로 넘치거나,
// HTML의 rowspan이 텍스트 행보다 큰 경우)은 버린다. 실행 취소 한 단계.
export function pasteGrid(
  doc: Y.Doc,
  target: CellRange,
  grid: CellData[][],
  merges: CellRange[],
  origin: unknown,
  mode: PasteMode = "all",
): CellRange | null {
  let written: CellRange | null = null;
  doc.transact(() => {
    const area = writeGrid(doc, target, grid, origin, mode);
    written = area;
    if (!area || mode === "values") return;
    for (const m of rawMerges(doc)) if (intersects(m, area)) unsetMerge(doc, m);
    for (const m of merges) {
      const placed = {
        start: { row: target.start.row + m.start.row, col: target.start.col + m.start.col },
        end: { row: target.start.row + m.end.row, col: target.start.col + m.end.col },
      };
      if (placed.end.row <= area.end.row && placed.end.col <= area.end.col) setMerge(doc, placed);
    }
  }, origin);
  return written;
}

const setMerge = (doc: Y.Doc, m: CellRange) => mergeMap(doc).set(cellKey(m.start), cellKey(m.end));
const unsetMerge = (doc: Y.Doc, m: CellRange) => mergeMap(doc).delete(cellKey(m.start));

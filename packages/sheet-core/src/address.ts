// 셀 좌표 규약: row·col 모두 0부터. 화면 표기(A1)는 이 파일에서만 변환한다.
export type CellAddress = { row: number; col: number };
export type CellRange = { start: CellAddress; end: CellAddress };

export function colToLabel(col: number): string {
  let label = "";
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}

export function labelToCol(label: string): number {
  let n = 0;
  for (const ch of label.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function toA1({ row, col }: CellAddress): string {
  return `${colToLabel(col)}${row + 1}`;
}

export function parseA1(a1: string): CellAddress | null {
  const m = /^([A-Za-z]+)([1-9]\d*)$/.exec(a1.trim());
  if (!m) return null;
  return { row: Number(m[2]) - 1, col: labelToCol(m[1]!) };
}

// 드래그 방향과 무관하게 start가 좌상단, end가 우하단이 되도록 정규화한다.
export function isSingleCell({ start, end }: CellRange): boolean {
  return start.row === end.row && start.col === end.col;
}

export function normalizeRange(a: CellAddress, b: CellAddress): CellRange {
  return {
    start: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
    end: { row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) },
  };
}

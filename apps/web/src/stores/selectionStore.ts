import { SHEET_COLS, SHEET_ROWS, expandToMerges, normalizeRange, stepCell, type CellAddress, type CellRange } from "@sheet/core";
import { create } from "zustand";

// 엑셀의 세 상태: 준비(idle) · 입력(enter, 타이핑으로 값 교체) · 편집(edit, 기존 값 안에서 커서 이동)
export type EditMode = "idle" | "enter" | "edit";

type SelectionState = {
  active: CellAddress; // 셀 포인터 — 범위를 넓혀도 고정
  extent: CellAddress; // 범위의 반대쪽 모서리
  mode: EditMode;
  draft: string;
  original: string; // 편집을 시작한 순간의 셀 값 — 확정할 때 바뀌었는지 이것과 비교한다
  tabStartCol: number | null; // Tab으로 옮겨 간 뒤 Enter가 돌아갈 열
  copied: CellRange | null; // 복사 표시(점선) 범위

  select: (addr: CellAddress, extend?: boolean) => void;
  selectRange: (active: CellAddress, extent: CellAddress) => void;
  // 이동은 병합을 한 칸으로 건너뛴다. 병합은 문서(Y.Doc) 상태라 여기 두지 않고 부를 때 받는다.
  move: (dRow: number, dCol: number, extend: boolean, merges: CellRange[]) => void;
  moveAfterTab: (back: boolean, merges: CellRange[]) => void;
  moveAfterEnter: (back: boolean, merges: CellRange[]) => void;
  startEditing: (mode: Exclude<EditMode, "idle">, draft: string, original: string) => void;
  setDraft: (draft: string) => void;
  stopEditing: () => void;
  setCopied: (range: CellRange | null) => void;
};

const clamp = ({ row, col }: CellAddress): CellAddress => ({
  row: Math.min(Math.max(row, 0), SHEET_ROWS - 1),
  col: Math.min(Math.max(col, 0), SHEET_COLS - 1),
});

const ORIGIN = { row: 0, col: 0 };

export const useSelectionStore = create<SelectionState>()((set) => ({
  active: ORIGIN,
  extent: ORIGIN,
  mode: "idle",
  draft: "",
  original: "",
  tabStartCol: null,
  copied: null,

  select: (addr, extend = false) =>
    set(extend ? { extent: clamp(addr) } : { active: clamp(addr), extent: clamp(addr), tabStartCol: null }),
  selectRange: (active, extent) => set({ active: clamp(active), extent: clamp(extent), tabStartCol: null }),
  move: (dRow, dCol, extend, merges) =>
    set((s) => {
      if (extend) return { extent: stepCell(s.extent, dRow, dCol, merges) };
      const next = stepCell(s.active, dRow, dCol, merges);
      return { active: next, extent: next, tabStartCol: null };
    }),
  moveAfterTab: (back, merges) =>
    set((s) => {
      const next = stepCell(s.active, 0, back ? -1 : 1, merges);
      return { active: next, extent: next, tabStartCol: s.tabStartCol ?? s.active.col };
    }),
  moveAfterEnter: (back, merges) =>
    set((s) => {
      const next = stepCell({ row: s.active.row, col: s.tabStartCol ?? s.active.col }, back ? -1 : 1, 0, merges);
      return { active: next, extent: next, tabStartCol: null };
    }),
  startEditing: (mode, draft, original) => set({ mode, draft, original, copied: null }),
  setDraft: (draft) => set({ draft }),
  stopEditing: () => set({ mode: "idle", draft: "", original: "" }),
  setCopied: (copied) => set({ copied }),
}));

// 선택 범위 — 걸친 병합을 모두 품도록 넓힌다 (엑셀: 병합 칸 일부만 고를 수 없다)
export const selectedRange = (s: Pick<SelectionState, "active" | "extent">, merges: CellRange[]): CellRange =>
  expandToMerges(normalizeRange(s.active, s.extent), merges);

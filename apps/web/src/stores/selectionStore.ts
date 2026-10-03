import { SHEET_COLS, SHEET_ROWS, normalizeRange, type CellAddress, type CellRange } from "@sheet/core";
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
  move: (dRow: number, dCol: number, extend?: boolean) => void;
  moveAfterTab: (back: boolean) => void;
  moveAfterEnter: (back: boolean) => void;
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
  move: (dRow, dCol, extend = false) =>
    set((s) => {
      if (extend) return { extent: clamp({ row: s.extent.row + dRow, col: s.extent.col + dCol }) };
      const next = clamp({ row: s.active.row + dRow, col: s.active.col + dCol });
      return { active: next, extent: next, tabStartCol: null };
    }),
  moveAfterTab: (back) =>
    set((s) => {
      const next = clamp({ row: s.active.row, col: s.active.col + (back ? -1 : 1) });
      return { active: next, extent: next, tabStartCol: s.tabStartCol ?? s.active.col };
    }),
  moveAfterEnter: (back) =>
    set((s) => {
      const next = clamp({ row: s.active.row + (back ? -1 : 1), col: s.tabStartCol ?? s.active.col });
      return { active: next, extent: next, tabStartCol: null };
    }),
  startEditing: (mode, draft, original) => set({ mode, draft, original, copied: null }),
  setDraft: (draft) => set({ draft }),
  stopEditing: () => set({ mode: "idle", draft: "", original: "" }),
  setCopied: (copied) => set({ copied }),
}));

export const selectedRange = (s: Pick<SelectionState, "active" | "extent">): CellRange => normalizeRange(s.active, s.extent);

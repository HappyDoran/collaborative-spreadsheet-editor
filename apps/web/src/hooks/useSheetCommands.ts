"use client";

import { FORMATS, parseTSV, toHTML, toTSV, type CellData, type CellFormat } from "@sheet/core";
import { useMemo, type ClipboardEvent, type KeyboardEvent } from "react";
import { selectedRange, useSelectionStore } from "@/stores/selectionStore";
import type { SheetActions } from "./useSheet";

const FORMAT_KEYS: Record<string, CellFormat> = { b: "bold", i: "italic", u: "underline" };
const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

// 엑셀 조작 관례(DESIGN.md 7절)를 한 곳에 모은 명령 모음. 그리드 입력칸과 값 편집줄이 같이 쓴다.
export function useSheetCommands(actions: SheetActions) {
  return useMemo(() => {
    const state = useSelectionStore.getState;

    // 입력·편집 중인 값을 확정한다. 값이 그대로면 쓰지 않는다 — 실행 취소 스택에 빈 단계가 생기지 않게.
    const commit = () => {
      const s = state();
      if (s.mode === "idle") return;
      if (s.draft !== (actions.read(s.active)?.value ?? "")) actions.setValue(s.active, s.draft);
      s.stopEditing();
    };

    const cancel = () => {
      const s = state();
      if (s.mode !== "idle") s.stopEditing();
      else s.setCopied(null);
    };

    const commitAndMove = (key: "Enter" | "Tab", back: boolean) => {
      commit();
      if (key === "Enter") state().moveAfterEnter(back);
      else state().moveAfterTab(back);
    };

    const toggle = (format: CellFormat) => {
      commit();
      actions.toggleFormat(selectedRange(state()), format);
    };

    const startEditing = () => {
      const s = state();
      if (s.mode === "idle") s.startEditing("edit", actions.read(s.active)?.value ?? "");
    };

    // 준비 상태에서만 셀 복사로 동작한다. 입력·편집 중에는 입력칸 글자의 기본 복사를 그대로 둔다.
    const copy = (e: ClipboardEvent, cut: boolean) => {
      const s = state();
      if (s.mode !== "idle") return;
      e.preventDefault();
      const range = selectedRange(s);
      const grid = actions.readGrid(range);
      e.clipboardData.setData("text/plain", toTSV(grid));
      e.clipboardData.setData("text/html", toHTML(grid));
      if (cut) {
        actions.clear(range);
        s.setCopied(null);
      } else s.setCopied(range);
    };

    const paste = (e: ClipboardEvent) => {
      const s = state();
      if (s.mode !== "idle") return;
      e.preventDefault();
      const grid =
        tableFromHTML(e.clipboardData.getData("text/html")) ??
        parseTSV(e.clipboardData.getData("text/plain")).map((row) => row.map((value) => ({ value })));
      const written = actions.paste(selectedRange(s), grid);
      if (written) s.selectRange(written.start, written.end);
      s.setCopied(null);
    };

    const onGridKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      // 한글 조합 중 키는 IME 몫이다. 조합을 끝낸 뒤의 keydown만 처리한다.
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      const s = state();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod) {
        if (key in FORMAT_KEYS) toggle(FORMAT_KEYS[key]!);
        else if (s.mode === "idle" && (key === "z" || key === "y")) {
          if (key === "y" || e.shiftKey) actions.redo();
          else actions.undo();
        } else if (s.mode === "idle" && key === "a") s.selectRange({ row: 0, col: 0 }, { row: Infinity, col: Infinity });
        else return; // C·X·V는 copy/cut/paste 이벤트로, 편집 중 Z는 입력칸 기본 동작으로
        e.preventDefault();
        return;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        commitAndMove(e.key, e.shiftKey);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
      const arrow = ARROWS[e.key];
      if (arrow && s.mode !== "edit") {
        e.preventDefault();
        commit();
        state().move(arrow[0], arrow[1], e.shiftKey);
        return;
      }
      if (s.mode !== "idle") return;
      if (e.key === "F2") {
        e.preventDefault();
        startEditing();
      } else if (e.key === "Delete") {
        e.preventDefault();
        actions.clear(selectedRange(s));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        s.startEditing("enter", "");
      }
      // 그 밖의 글자는 입력칸에 그대로 들어가고 onChange가 입력 모드로 바꾼다.
    };

    const onGridChange = (value: string) => {
      const s = state();
      if (s.mode === "idle") s.startEditing("enter", value);
      else s.setDraft(value);
    };

    return { commit, cancel, commitAndMove, toggle, startEditing, copy, paste, onGridKeyDown, onGridChange };
  }, [actions]);
}

export type SheetCommands = ReturnType<typeof useSheetCommands>;

// 클립보드 HTML의 첫 표를 읽는다. 이 앱·구글 시트처럼 서식을 inline style이나 b/i/u 태그로 담은 경우 서식도 살린다.
// 표가 없으면(일반 웹 글 복사 등) null — 호출자가 텍스트로 대신 읽는다.
function tableFromHTML(html: string): CellData[][] | null {
  if (!html) return null;
  const table = new DOMParser().parseFromString(html, "text/html").querySelector("table");
  if (!table) return null;
  const grid = Array.from(table.rows, (tr) =>
    Array.from(tr.cells, (td): CellData => {
      const cell: CellData = { value: td.textContent ?? "" };
      const style = (td.getAttribute("style") ?? "").toLowerCase();
      const has = (tags: string) => td.querySelector(tags) !== null;
      const on: Record<CellFormat, boolean> = {
        bold: /font-weight:\s*(bold|[6-9]00)/.test(style) || has("b, strong"),
        italic: style.includes("font-style:italic") || has("i, em"),
        underline: style.includes("underline") || has("u"),
      };
      for (const f of FORMATS) if (on[f]) cell[f] = true;
      return cell;
    }),
  );
  return grid.length ? grid : null;
}

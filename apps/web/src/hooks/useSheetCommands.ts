"use client";

import { toHTML, toTSV, type CellData, type CellFormat, type PasteMode } from "@sheet/core";
import { useMemo, type ClipboardEvent, type KeyboardEvent } from "react";
import { selectedRange, useSelectionStore } from "@/stores/selectionStore";
import { useStatusStore } from "@/stores/statusStore";
import { gridFromClipboard } from "./clipboardHtml";
import { shortcut } from "./shortcut";
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
    // ⌘⇧V: keydown에서 표시해 두면 이어지는 paste 이벤트가 값만 붙인다 (클립보드는 paste 이벤트에서만 읽힌다)
    let nextPasteMode: PasteMode = "all";

    // 입력·편집을 시작한다. 시작 순간의 셀 값을 함께 기록한다.
    const begin = (mode: "enter" | "edit", draft: string) =>
      state().startEditing(mode, draft, actions.read(state().active)?.value ?? "");

    // 입력·편집 중인 값을 확정한다. 시작한 뒤 바꾸지 않았으면 쓰지 않는다 — 그 사이 다른 탭이 쓴 값을
    // 편집을 열 때의 옛 값으로 덮지 않고, 실행 취소 스택에 빈 단계도 생기지 않는다.
    const commit = () => {
      const s = state();
      if (s.mode === "idle") return;
      if (s.draft !== s.original) actions.setValue(s.active, s.draft);
      s.stopEditing();
    };

    const cancel = () => {
      const s = state();
      if (s.mode !== "idle") s.stopEditing();
      else s.setCopied(null);
    };

    // Alt(⌥)+Enter: 셀 안 줄바꿈 (엑셀). 입력·편집 중에만 — 커서 자리에 넣고 초안을 맞춘다.
    const insertLineBreak = (el: HTMLTextAreaElement) => {
      if (state().mode === "idle") return;
      el.setRangeText("\n", el.selectionStart, el.selectionEnd, "end");
      state().setDraft(el.value);
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
      if (s.mode === "idle") begin("edit", actions.read(s.active)?.value ?? "");
    };

    // 선택 범위를 클립보드 형식(탭 구분 텍스트 + 서식 HTML 표)으로. 엑셀·구글 시트도 이 둘을 읽는다.
    const selectionAsClipboard = () => {
      const range = selectedRange(state());
      const grid = actions.readGrid(range);
      return { range, text: toTSV(grid), html: toHTML(grid) };
    };

    // 클립보드에 쓴 뒤에 부른다 — 잘라내기는 원본을 지우고, 복사는 점선 표시를 남긴다
    const afterCopy = (range: ReturnType<typeof selectedRange>, cut: boolean) => {
      if (cut) {
        actions.clear(range);
        state().setCopied(null);
      } else state().setCopied(range);
    };

    const pasteGrid = (grid: CellData[][], mode: PasteMode = "all") => {
      const s = state();
      const written = actions.paste(selectedRange(s), grid, mode);
      if (written) s.selectRange(written.start, written.end);
      s.setCopied(null);
    };

    // 키보드(⌘C·⌘X). 준비 상태에서만 셀 복사로 동작한다. 입력·편집 중에는 입력칸 글자의 기본 복사를 그대로 둔다.
    const copy = (e: ClipboardEvent, cut: boolean) => {
      if (state().mode !== "idle") return;
      e.preventDefault();
      const { range, text, html } = selectionAsClipboard();
      e.clipboardData.setData("text/plain", text);
      e.clipboardData.setData("text/html", html);
      afterCopy(range, cut);
    };

    // 키보드(⌘V). 브라우저가 클립보드를 이벤트로 넘겨준다.
    const paste = (e: ClipboardEvent) => {
      if (state().mode !== "idle") return;
      e.preventDefault();
      const mode = nextPasteMode;
      nextPasteMode = "all";
      pasteGrid(gridFromClipboard(e.clipboardData.getData("text/html"), e.clipboardData.getData("text/plain")), mode);
    };

    // 우클릭 메뉴(DESIGN.md 14절). 메뉴 클릭은 사용자 동작이라 쓰기는 권한 없이 된다.
    const copyFromMenu = async (cut: boolean) => {
      commit();
      const { range, text, html } = selectionAsClipboard();
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
        afterCopy(range, cut);
      } catch {
        useStatusStore.getState().show(`메뉴로는 ${cut ? "잘라낼" : "복사할"} 수 없어요. ${shortcut(cut ? "X" : "C")}를 써 주세요.`);
      }
    };

    // 메뉴의 붙여넣기는 클립보드 읽기 권한이 필요하다. 거절·미지원이면 ⌘V를 안내한다.
    // 권한을 묻는 중이면 사용자가 창을 무시할 수 있어 먼저 안내를 띄운다 — 아무 반응 없이 멈춘 것처럼 보이지 않게.
    const pasteFromMenu = async (mode: PasteMode = "all") => {
      commit();
      const notice = useStatusStore.getState().show;
      const denied = `메뉴로는 붙여넣을 수 없어요. ${shortcut("V")}로 붙여넣어 주세요.`;
      const permission = await navigator.permissions
        ?.query({ name: "clipboard-read" as PermissionName })
        .then((p) => p.state)
        .catch(() => "unknown"); // Safari 등은 이 권한 조회를 지원하지 않는다 — 바로 읽기를 시도한다
      if (permission === "denied") return notice(denied);
      if (permission === "prompt") notice(`브라우저가 클립보드 접근을 물으면 허용해 주세요. ${shortcut("V")}로도 붙여넣을 수 있어요.`);
      try {
        const [item] = await navigator.clipboard.read();
        if (!item) throw new Error("빈 클립보드");
        const read = async (type: string) => (item.types.includes(type) ? (await item.getType(type)).text() : "");
        pasteGrid(gridFromClipboard(await read("text/html"), await read("text/plain")), mode);
      } catch {
        notice(denied);
      }
    };

    const clearSelection = () => {
      commit();
      actions.clear(selectedRange(state()));
    };

    const clearFormatsOfSelection = () => {
      commit();
      actions.clearFormats(selectedRange(state()));
    };

    const onGridKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // 한글 조합 중 키는 IME 몫이다. 조합을 끝낸 뒤의 keydown만 처리한다.
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      const s = state();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod) {
        if (key === "v" && e.shiftKey && s.mode === "idle") {
          nextPasteMode = "values"; // 기본 동작(paste 이벤트)은 그대로 둔다
          return;
        }
        if (key in FORMAT_KEYS) toggle(FORMAT_KEYS[key]!);
        else if (key === "\\") clearFormatsOfSelection();
        else if (s.mode === "idle" && (key === "z" || key === "y")) {
          if (key === "y" || e.shiftKey) actions.redo();
          else actions.undo();
        } else if (s.mode === "idle" && key === "a") s.selectRange({ row: 0, col: 0 }, { row: Infinity, col: Infinity });
        else return; // C·X·V는 copy/cut/paste 이벤트로, 편집 중 Z는 입력칸 기본 동작으로
        e.preventDefault();
        return;
      }

      if (e.key === "Enter" && e.altKey) {
        e.preventDefault();
        insertLineBreak(e.currentTarget);
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
        begin("enter", "");
      }
      // 그 밖의 글자는 입력칸에 그대로 들어가고 onChange가 입력 모드로 바꾼다.
    };

    const onGridChange = (value: string) => {
      const s = state();
      if (s.mode === "idle") begin("enter", value);
      else s.setDraft(value);
    };

    return {
      commit,
      cancel,
      commitAndMove,
      insertLineBreak,
      toggle,
      startEditing,
      copy,
      paste,
      copyFromMenu,
      pasteFromMenu,
      clearSelection,
      clearFormatsOfSelection,
      onGridKeyDown,
      onGridChange,
    };
  }, [actions]);
}

export type SheetCommands = ReturnType<typeof useSheetCommands>;

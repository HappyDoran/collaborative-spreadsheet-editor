"use client";

import {
  clearFormats,
  clearValues,
  createUndoManager,
  mergeCells,
  mergeLosesValues,
  observeCells,
  pasteGrid,
  readMerges,
  unmergeCells,
  readCell,
  readGrid,
  setCellValue,
  setValues,
  toggleFormat,
  type CellAddress,
  type CellData,
  type CellFormat,
  type CellRange,
  type PasteMode,
} from "@sheet/core";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { openSheetSession, type SheetSession } from "@/collab/sheetSession";
import { useStatusStore } from "@/stores/statusStore";

export type SheetActions = {
  read: (addr: CellAddress) => CellData | undefined;
  readGrid: (range: CellRange) => CellData[][];
  setValue: (addr: CellAddress, value: string) => void;
  clear: (range: CellRange) => void;
  clearFormats: (range: CellRange) => void;
  toggleFormat: (range: CellRange, format: CellFormat) => void;
  paste: (target: CellRange, grid: CellData[][], merges: CellRange[], mode?: PasteMode) => CellRange | null;
  merges: () => CellRange[]; // 겹침을 정리한 병합 목록 (core readMerges)
  merge: (range: CellRange) => void;
  unmerge: (range: CellRange) => void;
  mergeLosesValues: (range: CellRange) => boolean;
  setValues: (entries: { addr: CellAddress; value: string }[]) => void;
  undo: () => void;
  redo: () => void;
};

export type SheetState =
  | { status: "loading" }
  | {
      status: "ready";
      actions: SheetActions;
      awareness: Awareness;
      version: number;
      canUndo: boolean;
      canRedo: boolean;
    };

// Y.Doc 변경과 undo 스택 변화를 하나의 숫자로 구독한다. 셀 컴포넌트는 memo라 실제로 바뀐 셀만 다시 그린다.
function subscribeTo(doc: Y.Doc, undo: Y.UndoManager) {
  let version = 0;
  return {
    subscribe(onChange: () => void) {
      const bump = () => {
        version++;
        onChange();
      };
      const unobserve = observeCells(doc, bump);
      undo.on("stack-item-added", bump);
      undo.on("stack-item-popped", bump);
      undo.on("stack-cleared", bump);
      return () => {
        unobserve();
        undo.off("stack-item-added", bump);
        undo.off("stack-item-popped", bump);
        undo.off("stack-cleared", bump);
      };
    },
    getVersion: () => version,
  };
}

const NOOP_STORE = { subscribe: () => () => {}, getVersion: () => 0 };

export function useSheet(sheetId: string): SheetState {
  const [session, setSession] = useState<SheetSession | null>(null);

  useEffect(() => {
    const s = openSheetSession(sheetId);
    let alive = true;
    // 저장된 내용을 다 불러온 뒤에 화면을 연다 — 빈 시트가 깜박이거나 로드 전에 쓰지 않도록.
    void s.whenReady.then(() => alive && setSession(s));
    return () => {
      alive = false;
      s.destroy();
    };
  }, [sheetId]);

  const undo = useMemo(() => (session ? createUndoManager(session.doc, session.origin) : null), [session]);
  useEffect(() => () => undo?.destroy(), [undo]);

  const store = useMemo(() => (session && undo ? subscribeTo(session.doc, undo) : NOOP_STORE), [session, undo]);
  const version = useSyncExternalStore(store.subscribe, store.getVersion, () => 0);

  const actions = useMemo<SheetActions | null>(() => {
    if (!session || !undo) return null;
    const { doc, origin } = session;
    return {
      read: (addr) => readCell(doc, addr),
      readGrid: (range) => readGrid(doc, range),
      setValue: (addr, value) => setCellValue(doc, addr, value, origin),
      clear: (range) => clearValues(doc, range, origin),
      clearFormats: (range) => clearFormats(doc, range, origin),
      toggleFormat: (range, format) => toggleFormat(doc, range, format, origin),
      paste: (target, grid, merges, mode) => pasteGrid(doc, target, grid, merges, origin, mode),
      merges: () => readMerges(doc),
      merge: (range) => mergeCells(doc, range, origin),
      unmerge: (range) => unmergeCells(doc, range, origin),
      mergeLosesValues: (range) => mergeLosesValues(doc, range),
      // AI 적용: 실행 취소 단계에 이름을 붙여 되돌릴 때 무엇을 되돌렸는지 알린다 (captureTimeout 0 — 방금 쓴 단계가 마지막)
      setValues: (entries) => {
        setValues(doc, entries, origin);
        undo.undoStack.at(-1)?.meta.set("label", "AI 적용");
      },
      undo: () => {
        const label = undo.undo()?.meta.get("label");
        if (label) useStatusStore.getState().show(`${label}을 되돌렸어요.`);
      },
      redo: () => void undo.redo(),
    };
  }, [session, undo]);

  if (!session || !actions || !undo) return { status: "loading" };
  return {
    status: "ready",
    actions,
    awareness: session.awareness,
    version,
    canUndo: undo.canUndo(),
    canRedo: undo.canRedo(),
  };
}

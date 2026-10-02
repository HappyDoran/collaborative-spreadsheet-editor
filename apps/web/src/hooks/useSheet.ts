"use client";

import {
  clearValues,
  createUndoManager,
  getCells,
  readCell,
  readGrid,
  setCellValue,
  toggleFormat,
  writeGrid,
  type CellAddress,
  type CellData,
  type CellFormat,
  type CellRange,
} from "@sheet/core";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import { openSheetSession, type SheetSession } from "@/collab/sheetSession";

export type SheetActions = {
  read: (addr: CellAddress) => CellData | undefined;
  readGrid: (range: CellRange) => CellData[][];
  setValue: (addr: CellAddress, value: string) => void;
  clear: (range: CellRange) => void;
  toggleFormat: (range: CellRange, format: CellFormat) => void;
  paste: (target: CellRange, grid: CellData[][]) => CellRange | null;
  undo: () => void;
  redo: () => void;
};

export type SheetState =
  | { status: "loading" }
  | { status: "ready"; actions: SheetActions; version: number; canUndo: boolean; canRedo: boolean };

// Y.Doc 변경과 undo 스택 변화를 하나의 숫자로 구독한다. 셀 컴포넌트는 memo라 실제로 바뀐 셀만 다시 그린다.
function subscribeTo(doc: Y.Doc, undo: Y.UndoManager) {
  let version = 0;
  return {
    subscribe(onChange: () => void) {
      const bump = () => {
        version++;
        onChange();
      };
      const cells = getCells(doc);
      cells.observeDeep(bump);
      undo.on("stack-item-added", bump);
      undo.on("stack-item-popped", bump);
      undo.on("stack-cleared", bump);
      return () => {
        cells.unobserveDeep(bump);
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
      toggleFormat: (range, format) => toggleFormat(doc, range, format, origin),
      paste: (target, grid) => writeGrid(doc, target, grid, origin),
      undo: () => void undo.undo(),
      redo: () => void undo.redo(),
    };
  }, [session, undo]);

  if (!actions || !undo) return { status: "loading" };
  return { status: "ready", actions, version, canUndo: undo.canUndo(), canRedo: undo.canRedo() };
}

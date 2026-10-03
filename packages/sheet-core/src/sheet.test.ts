import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  SHEET_COLS,
  SHEET_ROWS,
  clearValues,
  createUndoManager,
  getCells,
  readCell,
  readGrid,
  setCellValue,
  setValues,
  toggleFormat,
  writeGrid,
} from "./sheet";

const LOCAL = Symbol("local");
const range = (r1: number, c1: number, r2: number, c2: number) => ({
  start: { row: r1, col: c1 },
  end: { row: r2, col: c2 },
});

// 두 탭: 한쪽 update를 다른 쪽에 "remote" origin으로 적용한다.
function connect(a: Y.Doc, b: Y.Doc) {
  a.on("update", (u: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(b, u, "remote"));
  b.on("update", (u: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(a, u, "remote"));
}

describe("sheet 연산", () => {
  it("값을 쓰고 읽는다. 빈 값 + 서식 없음이면 셀 키가 사라진다", () => {
    const doc = new Y.Doc();
    setCellValue(doc, { row: 1, col: 2 }, "42", LOCAL);
    expect(readCell(doc, { row: 1, col: 2 })).toEqual({ value: "42" });
    setCellValue(doc, { row: 1, col: 2 }, "", LOCAL);
    expect(getCells(doc).size).toBe(0);
  });

  it("Delete는 내용만 지우고 서식은 남긴다", () => {
    const doc = new Y.Doc();
    setCellValue(doc, { row: 0, col: 0 }, "a", LOCAL);
    toggleFormat(doc, range(0, 0, 0, 0), "bold", LOCAL);
    clearValues(doc, range(0, 0, 0, 0), LOCAL);
    expect(readCell(doc, { row: 0, col: 0 })).toEqual({ value: "", bold: true });
  });

  it("서식 토글: 범위 일부만 켜져 있으면 전부 켜고, 전부 켜져 있으면 끈다", () => {
    const doc = new Y.Doc();
    toggleFormat(doc, range(0, 0, 0, 0), "italic", LOCAL);
    toggleFormat(doc, range(0, 0, 0, 1), "italic", LOCAL);
    expect(readCell(doc, { row: 0, col: 1 })?.italic).toBe(true);
    toggleFormat(doc, range(0, 0, 0, 1), "italic", LOCAL);
    expect(getCells(doc).size).toBe(0);
  });

  it("붙여넣기: 좌상단부터 쓰고 시트 밖은 버린다", () => {
    const doc = new Y.Doc();
    const at = { row: SHEET_ROWS - 1, col: SHEET_COLS - 1 };
    const written = writeGrid(doc, { start: at, end: at }, [[{ value: "x" }, { value: "y" }], [{ value: "z" }]], LOCAL);
    expect(written).toEqual({ start: at, end: at });
    expect(getCells(doc).size).toBe(1);
  });

  it("붙여넣기: 값 하나를 범위에 붙이면 범위를 채운다, 서식 포함", () => {
    const doc = new Y.Doc();
    writeGrid(doc, range(0, 0, 1, 1), [[{ value: "7", bold: true }]], LOCAL);
    expect(readGrid(doc, range(0, 0, 1, 1)).flat()).toEqual(Array(4).fill({ value: "7", bold: true }));
  });

  it("붙여넣기는 원본에 없는 서식을 끈다", () => {
    const doc = new Y.Doc();
    toggleFormat(doc, range(0, 0, 0, 0), "bold", LOCAL);
    writeGrid(doc, range(0, 0, 0, 0), [[{ value: "plain" }]], LOCAL);
    expect(readCell(doc, { row: 0, col: 0 })).toEqual({ value: "plain" });
  });
});

describe("실행 취소", () => {
  it("범위 붙여넣기는 한 번의 undo로 되돌린다", () => {
    const doc = new Y.Doc();
    const undo = createUndoManager(doc, LOCAL);
    setCellValue(doc, { row: 0, col: 0 }, "before", LOCAL);
    writeGrid(doc, range(0, 0, 0, 0), [[{ value: "a" }, { value: "b" }], [{ value: "c" }]], LOCAL);
    undo.undo();
    expect(readGrid(doc, range(0, 0, 1, 1)).flat().map((c) => c.value)).toEqual(["before", "", "", ""]);
  });

  it("연속 입력은 합쳐지지 않고 한 단계씩 되돌린다", () => {
    const doc = new Y.Doc();
    const undo = createUndoManager(doc, LOCAL);
    setCellValue(doc, { row: 0, col: 0 }, "1", LOCAL);
    setCellValue(doc, { row: 0, col: 1 }, "2", LOCAL);
    undo.undo();
    expect(readCell(doc, { row: 0, col: 0 })?.value).toBe("1");
    expect(readCell(doc, { row: 0, col: 1 })).toBeUndefined();
  });

  it("여러 셀 값 일괄 쓰기(AI 적용)는 서식을 남기고 한 번의 undo로 되돌린다", () => {
    const doc = new Y.Doc();
    const undo = createUndoManager(doc, LOCAL);
    setCellValue(doc, { row: 0, col: 0 }, "1", LOCAL);
    toggleFormat(doc, range(0, 0, 0, 0), "bold", LOCAL);
    setValues(doc, [{ addr: { row: 0, col: 0 }, value: "10" }, { addr: { row: 1, col: 0 }, value: "20" }], LOCAL);
    expect(readCell(doc, { row: 0, col: 0 })).toEqual({ value: "10", bold: true });
    undo.undo();
    expect(readCell(doc, { row: 0, col: 0 })).toEqual({ value: "1", bold: true });
    expect(readCell(doc, { row: 1, col: 0 })).toBeUndefined();
  });

  it("내 변경만 되돌리고 다른 탭의 변경은 남긴다", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    connect(a, b);
    const undoA = createUndoManager(a, LOCAL);
    setCellValue(a, { row: 0, col: 0 }, "mine", LOCAL);
    setCellValue(b, { row: 0, col: 1 }, "theirs", LOCAL);
    undoA.undo();
    expect(readCell(a, { row: 0, col: 0 })).toBeUndefined();
    expect(readCell(a, { row: 0, col: 1 })?.value).toBe("theirs");
    expect(readCell(b, { row: 0, col: 0 })).toBeUndefined();
  });

  it("같은 셀의 값과 서식을 두 탭이 동시에 바꾸면 둘 다 남는다", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    setCellValue(a, { row: 0, col: 0 }, "seed", LOCAL);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    // 연결 전 각자 변경 → 이후 교환 (동시 편집)
    setCellValue(a, { row: 0, col: 0 }, "new", LOCAL);
    toggleFormat(b, range(0, 0, 0, 0), "bold", LOCAL);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    expect(readCell(a, { row: 0, col: 0 })).toEqual({ value: "new", bold: true });
    expect(readCell(b, { row: 0, col: 0 })).toEqual({ value: "new", bold: true });
  });
});

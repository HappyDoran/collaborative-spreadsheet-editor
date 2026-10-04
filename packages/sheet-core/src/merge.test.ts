import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { toHTML } from "./clipboard";
import {
  expandToMerges,
  isCovered,
  isOneCell,
  mergeCells,
  mergeLosesValues,
  pasteGrid,
  readMerges,
  stepCell,
  unmergeCells,
} from "./merge";
import { SHEET_COLS, createUndoManager, mergeMap, readCell, setCellValue } from "./sheet";

const LOCAL = Symbol("local");
const range = (r1: number, c1: number, r2: number, c2: number) => ({
  start: { row: r1, col: c1 },
  end: { row: r2, col: c2 },
});
const at = (row: number, col: number) => ({ row, col });

function connect(a: Y.Doc, b: Y.Doc) {
  a.on("update", (u: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(b, u, "remote"));
  b.on("update", (u: Uint8Array, origin: unknown) => origin !== "remote" && Y.applyUpdate(a, u, "remote"));
}

describe("셀 병합", () => {
  it("병합하면 왼쪽 위 값만 남고 서식은 둔다. 실행 취소 한 번에 병합과 지운 값이 돌아온다", () => {
    const doc = new Y.Doc();
    const undo = createUndoManager(doc, LOCAL);
    setCellValue(doc, at(0, 0), "제목", LOCAL);
    setCellValue(doc, at(0, 1), "지워짐", LOCAL);
    expect(mergeLosesValues(doc, range(0, 0, 1, 1))).toBe(true);
    expect(mergeLosesValues(doc, range(0, 0, 0, 0))).toBe(false);

    mergeCells(doc, range(0, 0, 1, 1), LOCAL);
    expect(readMerges(doc)).toEqual([range(0, 0, 1, 1)]);
    expect(readCell(doc, at(0, 0))?.value).toBe("제목");
    expect(readCell(doc, at(0, 1))).toBeUndefined();

    undo.undo();
    expect(readMerges(doc)).toEqual([]);
    expect(readCell(doc, at(0, 1))?.value).toBe("지워짐");
  });

  it("걸친 병합은 흡수하고, 한 칸은 병합하지 않는다. 해제는 범위에 걸친 병합을 모두 푼다", () => {
    const doc = new Y.Doc();
    mergeCells(doc, range(0, 0, 0, 1), LOCAL);
    mergeCells(doc, range(0, 1, 1, 2), LOCAL); // 앞 병합과 겹친다 → 앞 병합은 풀린다
    expect(readMerges(doc)).toEqual([range(0, 1, 1, 2)]);
    mergeCells(doc, range(5, 5, 5, 5), LOCAL);
    expect(readMerges(doc)).toHaveLength(1);
    unmergeCells(doc, range(1, 2, 1, 2), LOCAL);
    expect(readMerges(doc)).toEqual([]);
  });

  it("두 탭이 동시에 겹치는 범위를 병합하면 양쪽 모두 위·왼쪽 병합 하나만 그린다", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    mergeCells(a, range(0, 1, 1, 2), LOCAL); // 연결 전 — 동시 편집
    mergeCells(b, range(0, 0, 0, 1), LOCAL);
    connect(a, b);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b), "remote");
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a), "remote");
    expect(readMerges(a)).toEqual([range(0, 0, 0, 1)]);
    expect(readMerges(b)).toEqual(readMerges(a));
    // 해제하면 가려졌던 항목까지 함께 지운다 — 풀었는데 다른 병합이 나타나지 않게
    unmergeCells(a, range(0, 0, 1, 2), LOCAL);
    expect(readMerges(b)).toEqual([]);
  });

  it("문서의 잘못된 항목(시트 밖, 거꾸로, 한 칸, 깨진 키)은 무시한다", () => {
    const doc = new Y.Doc();
    const m = mergeMap(doc);
    m.set("0:0", `0:${SHEET_COLS}`);
    m.set("3:3", "2:2");
    m.set("4:4", "4:4");
    m.set("x", "1:1");
    m.set("6:6", true);
    expect(readMerges(doc)).toEqual([]);
  });

  it("선택 범위는 걸친 병합을 모두 품도록 넓어지고, 병합 하나와 같으면 한 칸이다", () => {
    const merges = [range(0, 1, 1, 2), range(2, 2, 3, 3)];
    expect(expandToMerges(range(0, 0, 0, 1), merges)).toEqual(range(0, 0, 1, 2));
    // 넓힌 범위가 다시 다른 병합에 걸치면 그것까지
    expect(expandToMerges(range(1, 1, 2, 1), merges)).toEqual(range(0, 1, 3, 3));
    expect(isOneCell(range(0, 1, 1, 2), merges)).toBe(true);
    expect(isOneCell(range(0, 0, 1, 2), merges)).toBe(false);
    expect(isCovered(merges, at(1, 2))).toBe(true);
    expect(isCovered(merges, at(0, 1))).toBe(false);
  });

  it("한 칸 이동: 병합 안에서는 가장자리 너머로, 병합에 들어가면 왼쪽 위에 선다. 시트 끝에서는 그대로", () => {
    const merges = [range(1, 1, 2, 3)];
    expect(stepCell(at(1, 1), 0, 1, merges)).toEqual(at(1, 4));
    expect(stepCell(at(1, 1), 1, 0, merges)).toEqual(at(3, 1));
    expect(stepCell(at(1, 0), 0, 1, merges)).toEqual(at(1, 1));
    expect(stepCell(at(3, 2), -1, 0, merges)).toEqual(at(1, 1));
    expect(stepCell(at(0, 0), -1, 0, merges)).toEqual(at(0, 0));
    expect(stepCell(at(0, SHEET_COLS - 1), 0, 1, [])).toEqual(at(0, SHEET_COLS - 1));
  });

  it("붙여넣기는 원본 병합을 놓고 쓴 범위에 걸친 병합을 푼다. 값만 붙여넣기는 병합을 건드리지 않는다", () => {
    const doc = new Y.Doc();
    const undo = createUndoManager(doc, LOCAL);
    mergeCells(doc, range(5, 0, 5, 1), LOCAL);
    const grid = [[{ value: "병합" }, { value: "" }, { value: "c" }]];
    pasteGrid(doc, range(5, 1, 5, 1), grid, [range(0, 0, 0, 1)], LOCAL);
    expect(readMerges(doc)).toEqual([range(5, 1, 5, 2)]);
    expect(readCell(doc, at(5, 3))?.value).toBe("c");
    undo.undo(); // 한 단계
    expect(readMerges(doc)).toEqual([range(5, 0, 5, 1)]);

    pasteGrid(doc, range(5, 0, 5, 0), grid, [range(0, 0, 0, 1)], LOCAL, "values");
    expect(readMerges(doc)).toEqual([range(5, 0, 5, 1)]);
    // 시트 밖으로 넘치는 병합은 버린다
    pasteGrid(doc, range(0, SHEET_COLS - 1, 0, SHEET_COLS - 1), grid, [range(0, 0, 0, 1)], LOCAL);
    expect(readMerges(doc)).toEqual([range(5, 0, 5, 1)]);
    // 원본 병합이 격자보다 크면(HTML rowspan > 텍스트 행) 버린다
    pasteGrid(doc, range(10, 0, 10, 0), grid, [range(0, 0, 2, 1)], LOCAL);
    expect(readMerges(doc)).toEqual([range(5, 0, 5, 1)]);
  });

  it("값 하나를 병합 칸에 붙이면 병합은 남고 왼쪽 위에만 들어간다. 값만 붙여넣기는 가려진 칸에 쓰지 않는다", () => {
    const doc = new Y.Doc();
    const undo = createUndoManager(doc, LOCAL);
    mergeCells(doc, range(0, 1, 0, 2), LOCAL);
    pasteGrid(doc, range(0, 1, 0, 2), [[{ value: "하나" }]], [], LOCAL);
    expect(readMerges(doc)).toEqual([range(0, 1, 0, 2)]);
    expect(readCell(doc, at(0, 1))?.value).toBe("하나");
    expect(readCell(doc, at(0, 2))?.value ?? "").toBe("");
    undo.undo(); // 한 단계
    expect(readCell(doc, at(0, 1))?.value ?? "").toBe("");

    pasteGrid(doc, range(0, 1, 0, 2), [[{ value: "a" }, { value: "b" }]], [], LOCAL, "values");
    expect(readMerges(doc)).toEqual([range(0, 1, 0, 2)]);
    expect(readCell(doc, at(0, 1))?.value).toBe("a");
    expect(readCell(doc, at(0, 2))?.value ?? "").toBe("");
  });

  it("복사 HTML은 병합을 colspan·rowspan으로 담고 가려진 칸은 쓰지 않는다", () => {
    const grid = [
      [{ value: "a" }, { value: "" }],
      [{ value: "" }, { value: "" }],
    ];
    expect(toHTML(grid, [range(0, 0, 1, 1)])).toBe('<table><tr><td colspan="2" rowspan="2">a</td></tr><tr></tr></table>');
  });
});

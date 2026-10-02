import { describe, expect, it } from "vitest";
import { parseTSV, toHTML, toTSV } from "./clipboard";

describe("clipboard", () => {
  it("탭·줄바꿈으로 나눈 텍스트를 격자로 읽는다. 끝 줄바꿈과 CRLF를 무시한다", () => {
    expect(parseTSV("a\tb\r\nc\td\r\n")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("따옴표로 감싼 값 안의 탭·줄바꿈·따옴표를 보존한다", () => {
    const grid = [[{ value: 'say "hi"' }, { value: "line1\nline2" }], [{ value: "a\tb" }, { value: "" }]];
    const tsv = toTSV(grid);
    expect(parseTSV(tsv)).toEqual([['say "hi"', "line1\nline2"], ["a\tb", ""]]);
  });

  it("값 하나는 1×1 격자", () => {
    expect(parseTSV("42")).toEqual([["42"]]);
  });

  it("HTML 표에 서식을 inline style로 담고 특수문자를 이스케이프한다", () => {
    expect(toHTML([[{ value: "<b>", bold: true }, { value: "x" }]])).toBe(
      '<table><tr><td style="font-weight:bold">&lt;b&gt;</td><td>x</td></tr></table>',
    );
  });
});

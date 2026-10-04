import { describe, expect, it } from "vitest";
import { cssClassRules, formatsFromStyle, parseTSV, toHTML, toTSV } from "./clipboard";

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

  it("셀 안 줄바꿈은 HTML에서 같은 칸의 <br>로 쓴다", () => {
    expect(toHTML([[{ value: "줄1\n줄2" }]])).toBe(
      '<table><tr><td>줄1<br style="mso-data-placement:same-cell">줄2</td></tr></table>',
    );
  });
});

describe("다른 앱의 서식 읽기", () => {
  it("구글 시트식 inline style — 공백·숫자 굵기·text-decoration-line 허용", () => {
    expect(formatsFromStyle("overflow:hidden;font-weight:bold;")).toEqual({ bold: true });
    expect(formatsFromStyle("font-weight: 700; font-style: italic")).toEqual({ bold: true, italic: true });
    expect(formatsFromStyle("text-decoration-line: underline line-through")).toEqual({ underline: true });
  });

  it("굵기 400·normal, 기울임 normal, 밑줄 none은 서식이 아니다", () => {
    expect(formatsFromStyle("font-weight:400;font-style:normal;text-decoration:none")).toEqual({});
  });

  it("Excel식 <style> 클래스 규칙을 클래스 이름별로 모은다", () => {
    const css = "<!--td {padding:0px;}\n.xl65\n\t{mso-style-parent:style0;\n\tfont-weight:700;}\ntd.xl66 {font-style:italic;}\n.font5 {text-decoration:underline;}-->";
    const rules = cssClassRules(css);
    expect(formatsFromStyle(rules.get("xl65")!)).toEqual({ bold: true });
    expect(formatsFromStyle(rules.get("xl66")!)).toEqual({ italic: true });
    expect(formatsFromStyle(rules.get("font5")!)).toEqual({ underline: true });
    expect(rules.has("td")).toBe(false);
  });
});


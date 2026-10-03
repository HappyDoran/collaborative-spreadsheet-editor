import { cssClassRules, formatsFromStyle, parseTSV, type CellData, type CellFormat } from "@sheet/core";

// 다른 앱이 클립보드에 담은 내용 → 붙여넣을 셀 격자 (DESIGN.md 7절 복사·붙여넣기).
// DOMParser가 필요해 core 밖에 둔다. 서식 문자열 판정은 core의 formatsFromStyle·cssClassRules.

// 값은 탭 구분 텍스트에서, 서식은 HTML에서 읽는다. 텍스트 쪽이 셀 안 줄바꿈·따옴표를 정확히 담는다
// (HTML 칸의 글자는 <br>이 빠지고 소스 줄바꿈·들여쓰기가 섞인다).
// HTML 표가 있으면 칸 위치대로 서식을 입힌다 — colspan은 그만큼 칸을 차지한다. rowspan은 보지 않는다.
// 구글 시트는 셀 하나를 복사하면 표 없이 글자 조각(<span data-sheets-root>)만 담는다 —
// 붙일 값이 하나면 그 조각의 서식을 값에 입힌다.
export function gridFromClipboard(html: string, text: string): CellData[][] {
  const parsed = html ? parseClipboardHTML(html) : null;
  const table = parsed?.doc.querySelector("table");
  // 텍스트 없이 HTML만 있으면 칸의 글자로 대신한다
  const values = !text && table ? Array.from(table.rows, (tr) => Array.from(tr.cells, (td) => td.textContent ?? "")) : parseTSV(text);
  const grid: CellData[][] = values.map((row) => row.map((value) => ({ value })));
  if (!parsed) return grid;
  const { doc, formatsOf } = parsed;
  if (table) {
    Array.from(table.rows).forEach((tr, r) => {
      const formats = Array.from(tr.cells).flatMap((td) => Array<Partial<Record<CellFormat, true>>>(td.colSpan).fill(formatsOf(td)));
      grid[r]?.forEach((cell, c) => Object.assign(cell, formats[c]));
    });
  } else if (grid.length === 1 && grid[0]!.length === 1) Object.assign(grid[0]![0]!, formatsOf(doc.body));
  return grid;
}

const FORMAT_TAGS: Record<CellFormat, string> = { bold: "b, strong", italic: "i, em", underline: "u" };
// 태그에 붙은 style이 서식을 끄는 경우. 구글 문서는 굵지 않은 글도 <b style="font-weight:normal">로 감싼다.
const FORMAT_OFF: Record<CellFormat, RegExp> = {
  bold: /font-weight:\s*(normal|[1-5]00)/i,
  italic: /font-style:\s*normal/i,
  underline: /text-decoration[^;]*none/i,
};

// 서식은 요소와 그 안 글자 조각의 style 속성(구글 시트·이 앱), <style> 클래스 규칙(Excel), b/i/u 태그를 모두 본다.
// 판정은 core의 formatsFromStyle.
function parseClipboardHTML(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const classes = cssClassRules(Array.from(doc.querySelectorAll("style"), (el) => el.textContent ?? "").join("\n"));
  const declsOf = (el: Element) =>
    [...el.classList].map((c) => classes.get(c) ?? "").join(";") + ";" + (el.getAttribute("style") ?? "");
  const formatsOf = (root: Element): Partial<Record<CellFormat, true>> => {
    const formats = formatsFromStyle([root, ...root.querySelectorAll("*")].map(declsOf).join(";"));
    for (const [format, tags] of Object.entries(FORMAT_TAGS) as [CellFormat, string][]) {
      if ([...root.querySelectorAll(tags)].some((el) => !FORMAT_OFF[format].test(el.getAttribute("style") ?? ""))) {
        formats[format] = true;
      }
    }
    return formats;
  };
  return { doc, formatsOf };
}

import { cssClassRules, formatsFromStyle, parseTSV, type CellData, type CellFormat, type CellRange } from "@sheet/core";

// 다른 앱이 클립보드에 담은 내용 → 붙여넣을 셀 격자 (DESIGN.md 7절 복사·붙여넣기).
// DOMParser가 필요해 core 밖에 둔다. 서식 문자열 판정은 core의 formatsFromStyle·cssClassRules.

// 값은 탭 구분 텍스트에서, 서식은 HTML에서 읽는다. 텍스트 쪽이 셀 안 줄바꿈·따옴표를 정확히 담는다
// (HTML 칸의 글자는 <br>이 빠지고 소스 줄바꿈·들여쓰기가 섞인다).
// HTML 표가 있으면 칸 위치대로 서식을 입히고 colspan·rowspan을 병합으로 돌려준다(grid 안 좌표) —
// 병합 칸이 차지하는 자리를 표시해 가며 다음 칸의 열 위치를 정한다(엑셀·구글 시트·이 앱이 같은 형식).
// 구글 시트는 셀 하나를 복사하면 표 없이 글자 조각(<span data-sheets-root>)만 담는다 —
// 붙일 값이 하나면 그 조각의 서식을 값에 입힌다.
export function gridFromClipboard(html: string, text: string): { grid: CellData[][]; merges: CellRange[] } {
  const parsed = html ? parseClipboardHTML(html) : null;
  const table = parsed?.doc.querySelector("table");
  // 텍스트 없이 HTML만 있으면 칸의 글자로 대신한다
  const values = !text && table ? Array.from(table.rows, (tr) => Array.from(tr.cells, (td) => td.textContent ?? "")) : parseTSV(text);
  const grid: CellData[][] = values.map((row) => row.map((value) => ({ value })));
  const merges: CellRange[] = [];
  if (!parsed) return { grid, merges };
  const { doc, formatsOf } = parsed;
  if (table) {
    const taken = new Set<string>();
    Array.from(table.rows).forEach((tr, r) => {
      let c = 0;
      for (const td of Array.from(tr.cells)) {
        while (taken.has(`${r}:${c}`)) c++;
        const rows = Math.max(1, td.rowSpan);
        const cols = Math.max(1, td.colSpan);
        const formats = formatsOf(td);
        for (let dr = 0; dr < rows; dr++) {
          for (let dc = 0; dc < cols; dc++) {
            taken.add(`${r + dr}:${c + dc}`);
            const cell = grid[r + dr]?.[c + dc];
            if (cell) Object.assign(cell, formats);
          }
        }
        if (rows > 1 || cols > 1) merges.push({ start: { row: r, col: c }, end: { row: r + rows - 1, col: c + cols - 1 } });
        c += cols;
      }
    });
  } else if (grid.length === 1 && grid[0]!.length === 1) Object.assign(grid[0]![0]!, formatsOf(doc.body));
  return { grid, merges };
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

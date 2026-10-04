import type { CellData, CellFormat } from "./sheet";

// 엑셀·구글 시트와 같은 클립보드 형식: 탭으로 열, 줄바꿈으로 행을 나눈다.
// 탭·줄바꿈·따옴표가 든 값은 큰따옴표로 감싸고 안의 따옴표는 두 번 쓴다.
export function toTSV(grid: CellData[][]): string {
  const quote = (v: string) => (/[\t\n\r"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return grid.map((row) => row.map((c) => quote(c.value)).join("\t")).join("\n");
}

export function parseTSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  const src = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '"' && field === "") {
      // 따옴표로 시작한 필드: 닫는 따옴표까지가 값
      let j = i + 1;
      let quoted = "";
      while (j < src.length) {
        if (src[j] === '"' && src[j + 1] === '"') { quoted += '"'; j += 2; }
        else if (src[j] === '"') { j++; break; }
        else quoted += src[j++];
      }
      field = quoted;
      i = j;
      continue;
    }
    if (ch === "\t") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
    i++;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

const escapeHTML = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 서식을 inline style로 담은 표. 엑셀·구글 시트도 이 형태를 읽는다.
// 셀 안 줄바꿈은 <br>로 — HTML 글자의 줄바꿈은 공백으로 합쳐진다. mso-data-placement는 Excel이 같은 칸에 두게 하는 표시.
export function toHTML(grid: CellData[][]): string {
  const style = (c: CellData) =>
    [c.bold && "font-weight:bold", c.italic && "font-style:italic", c.underline && "text-decoration:underline"]
      .filter(Boolean)
      .join(";");
  const td = (c: CellData) => {
    const s = style(c);
    return `<td${s ? ` style="${s}"` : ""}>${escapeHTML(c.value).replace(/\n/g, '<br style="mso-data-placement:same-cell">')}</td>`;
  };
  return `<table>${grid.map((row) => `<tr>${row.map(td).join("")}</tr>`).join("")}</table>`;
}

// 다른 앱이 클립보드 HTML에 담은 서식 읽기 (DESIGN.md 7절 복사·붙여넣기).
// 구글 시트는 칸·글자 조각의 style 속성에, Excel은 <style> 안의 클래스 규칙(.xl65 { font-weight:700 })에 담는다.

// CSS 선언 문자열에서 굵게·기울임·밑줄. 공백·대소문자·숫자 굵기(600 이상)를 허용한다.
export function formatsFromStyle(decls: string): Partial<Record<CellFormat, true>> {
  const css = decls.toLowerCase().replace(/\s+/g, "");
  const out: Partial<Record<CellFormat, true>> = {};
  if (/font-weight:(bold|bolder|[6-9]00)/.test(css)) out.bold = true;
  if (/font-style:(italic|oblique)/.test(css)) out.italic = true;
  if (/text-decoration(-line)?:[^;]*underline/.test(css)) out.underline = true;
  return out;
}

// <style> 텍스트의 클래스 규칙 → 클래스 이름별 선언. Excel의 `.xl65 { … }`, `td.xl65 { … }` 형태.
export function cssClassRules(css: string): Map<string, string> {
  const rules = new Map<string, string>();
  for (const m of css.matchAll(/(?:^|[\s,}])[a-z]*\.([\w-]+)\s*\{([^}]*)\}/gi)) {
    rules.set(m[1]!, `${rules.get(m[1]!) ?? ""};${m[2]}`);
  }
  return rules;
}


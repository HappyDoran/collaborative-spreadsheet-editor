import type { CellData } from "./sheet";

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
export function toHTML(grid: CellData[][]): string {
  const style = (c: CellData) =>
    [c.bold && "font-weight:bold", c.italic && "font-style:italic", c.underline && "text-decoration:underline"]
      .filter(Boolean)
      .join(";");
  const td = (c: CellData) => {
    const s = style(c);
    return `<td${s ? ` style="${s}"` : ""}>${escapeHTML(c.value)}</td>`;
  };
  return `<table>${grid.map((row) => `<tr>${row.map(td).join("")}</tr>`).join("")}</table>`;
}

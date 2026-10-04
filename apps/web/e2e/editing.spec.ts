import { expect, test } from "@playwright/test";
import { MOD, cell, nameBox, openSheet, typeInto } from "./sheet";

// M1 단일 탭 편집 (docs/manual-scenarios.md M1)

test("M1-A1·A2 입력 후 Enter, Tab 두 번 뒤 Enter는 시작 열로", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "hello");
  await expect(cell(page, 0, 0)).toHaveText("hello");
  await expect(nameBox(page)).toHaveText("A2");

  for (const v of ["10", "20"]) {
    await page.keyboard.type(v);
    await page.keyboard.press("Tab");
  }
  await page.keyboard.type("30");
  await page.keyboard.press("Enter");
  await expect(nameBox(page)).toHaveText("A3");
  await expect(cell(page, 1, 0)).toHaveCSS("text-align", "right");
});

test("M1-A10 숫자 없이 기호만 있는 칸(-)은 글자처럼 왼쪽 정렬", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "-");
  await typeInto(page, 1, 0, "-5.5");
  await expect(cell(page, 0, 0)).toHaveCSS("text-align", "left");
  await expect(cell(page, 1, 0)).toHaveCSS("text-align", "right");
});

test("M1-A14 Alt+Enter는 셀 안 줄바꿈, 편집해도 줄바꿈이 남는다", async ({ context }) => {
  const page = await openSheet(context);
  await cell(page, 0, 0).click();
  await page.keyboard.type("줄1");
  await page.keyboard.press("Alt+Enter");
  await page.keyboard.type("줄2");
  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 0)).toHaveText("줄1\n줄2", { useInnerText: false });
  await expect(nameBox(page)).toHaveText("A2");

  // 편집칸은 줄 수만큼 펼쳐지고, 편집 뒤에도 줄바꿈이 지워지지 않는다 (input이던 때는 지워졌다)
  await cell(page, 0, 0).click();
  await page.keyboard.press("F2");
  expect((await page.getByLabel("셀 입력").boundingBox())?.height).toBe(48);
  await page.keyboard.type("!");
  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 0)).toHaveText("줄1\n줄2!", { useInnerText: false });

  await cell(page, 0, 0).click();
  await expect(page.getByLabel("셀 값")).toHaveValue("줄1\n줄2!");
});

test("M1-B7 열·행 머리글을 더블클릭해도 편집 모드로 들어가지 않는다", async ({ context }) => {
  const page = await openSheet(context);
  await page.locator('[data-col="2"]:not([data-row])').dblclick();
  await expect(nameBox(page)).toHaveText("C1:C100");
  await expect(page.getByText("준비", { exact: true })).toBeVisible();
  await page.locator('[data-row="4"]:not([data-col])').dblclick();
  await expect(nameBox(page)).toHaveText("A5:Z5");
  await expect(page.getByText("준비", { exact: true })).toBeVisible();
});

test("M1-A4·A6 F2는 이어 쓰기, Esc는 입력 취소", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "hello");
  await cell(page, 0, 0).click();
  await page.keyboard.press("F2");
  await page.keyboard.type("!");
  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 0)).toHaveText("hello!");

  await cell(page, 0, 0).click();
  await page.keyboard.type("bye");
  await page.keyboard.press("Escape");
  await expect(cell(page, 0, 0)).toHaveText("hello!");
});

test("M1-B2·C1 드래그 범위 선택과 범위 굵게", async ({ context }) => {
  const page = await openSheet(context);
  await cell(page, 2, 0).hover();
  await page.mouse.down();
  await cell(page, 4, 2).hover();
  await page.mouse.up();
  await expect(nameBox(page)).toHaveText("A3:C5");

  await page.keyboard.press(`${MOD}+b`);
  await expect(cell(page, 4, 2)).toHaveCSS("font-weight", "700");
});

test("M1-D1·D3·E1 복사·붙여넣기(값+서식), 단일 셀 채우기, 한 번 undo", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "10");
  await typeInto(page, 0, 1, "20");
  await cell(page, 0, 0).click();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press(`${MOD}+b`);
  await page.keyboard.press(`${MOD}+c`);

  await cell(page, 4, 3).click();
  await page.keyboard.press(`${MOD}+v`);
  await expect(cell(page, 4, 4)).toHaveText("20");
  await expect(cell(page, 4, 4)).toHaveCSS("font-weight", "700");
  await expect(nameBox(page)).toHaveText("D5:E5");

  await page.keyboard.press(`${MOD}+z`);
  await expect(cell(page, 4, 3)).toHaveText("");
  await expect(cell(page, 4, 4)).toHaveText("");

  await cell(page, 0, 0).click();
  await page.keyboard.press(`${MOD}+c`);
  await cell(page, 6, 0).click();
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press(`${MOD}+v`);
  await expect(cell(page, 7, 1)).toHaveText("10");
});

test("M1-D 외부 TSV 붙여넣기 — 따옴표 안의 탭 보존", async ({ context }) => {
  const page = await openSheet(context);
  await page.evaluate(() => navigator.clipboard.writeText('a\tb\n"q\tq"\tc\n'));
  await cell(page, 0, 0).click();
  await page.keyboard.press(`${MOD}+v`);
  await expect(cell(page, 1, 0)).toHaveText("q\tq");
  await expect(cell(page, 1, 1)).toHaveText("c");
});

test("M1-G1 한글 조합 입력의 첫 글자 유지 (CDP IME 주입)", async ({ context, browserName }) => {
  test.skip(browserName !== "chromium", "CDP는 Chromium 전용");
  const page = await openSheet(context);
  await cell(page, 0, 0).click();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "ㅎ", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.imeSetComposition", { text: "하", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.insertText", { text: "한" });
  await cdp.send("Input.imeSetComposition", { text: "ㄱ", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.insertText", { text: "글" });
  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 0)).toHaveText("한글");
});

test("M1-F1 새로고침 후 값·서식 유지", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "saved");
  await cell(page, 0, 0).click();
  await page.keyboard.press(`${MOD}+i`);
  await page.reload();
  await expect(cell(page, 0, 0)).toHaveText("saved");
  await expect(cell(page, 0, 0)).toHaveCSS("font-style", "italic");
});

// 다른 앱이 클립보드에 담는 HTML을 그대로 흉내 낸다 (서식 위치가 앱마다 다르다)
const EXCEL_HTML =
  "<html><head><style><!--td {padding:0px;}\n.xl65\n\t{mso-style-parent:style0;\n\tfont-weight:700;}\n.xl66\n\t{font-style:italic;}--></style></head>" +
  "<body><table><tr><td class=xl65>엑셀 굵게</td><td class=xl66>엑셀 기울임</td></tr></table></body></html>";
const SHEETS_HTML =
  '<google-sheets-html-origin><style type="text/css"><!--td {border: 1px solid #cccccc;}--></style>' +
  '<table><tbody><tr><td style="overflow:hidden;"><span style="font-size:10pt;font-weight:bold;">시트 굵게</span></td>' +
  '<td style="overflow:hidden; font-style: italic;">시트 기울임</td></tr></tbody></table>';

async function pasteHTML(page: import("@playwright/test").Page, html: string, text: string) {
  await page.evaluate(
    ([h, t]) =>
      navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([h], { type: "text/html" }), "text/plain": new Blob([t], { type: "text/plain" }) }),
      ]),
    [html, text],
  );
  await page.keyboard.press(`${MOD}+v`);
}

// 구글 시트에서 셀 하나를 복사했을 때 실제로 담기는 HTML (표 없이 span 하나 — 2026-10-03 클립보드에서 채취)
const SHEETS_SINGLE_CELL_HTML =
  "<meta charset='utf-8'><style type=\"text/css\"><!--td {border: 1px solid #cccccc;}br {mso-data-placement:same-cell;}--></style>" +
  '<span style="font-size:9pt;font-family:Arial;font-weight:bold;font-style:normal;text-align:center;" data-sheets-root="1">알아둘것</span>';

test("M1-D7b 구글 시트에서 셀 하나를 복사하면 표 없이 오는 서식도 살린다", async ({ context }) => {
  const page = await openSheet(context);
  await cell(page, 0, 0).click();
  await pasteHTML(page, SHEETS_SINGLE_CELL_HTML, "알아둘것");
  await expect(cell(page, 0, 0)).toHaveText("알아둘것");
  await expect(cell(page, 0, 0)).toHaveCSS("font-weight", "700");
  await expect(cell(page, 0, 0)).toHaveCSS("font-style", "normal");
});

test("M1-D7 Excel의 클래스 규칙 서식, 구글 시트의 글자 조각 서식을 붙여넣기에서 살린다", async ({ context }) => {
  const page = await openSheet(context);
  await cell(page, 0, 0).click();
  await pasteHTML(page, EXCEL_HTML, "엑셀 굵게\t엑셀 기울임");
  await expect(cell(page, 0, 0)).toHaveText("엑셀 굵게");
  await expect(cell(page, 0, 0)).toHaveCSS("font-weight", "700");
  await expect(cell(page, 0, 1)).toHaveCSS("font-style", "italic");

  await cell(page, 2, 0).click();
  await pasteHTML(page, SHEETS_HTML, "시트 굵게\t시트 기울임");
  await expect(cell(page, 2, 0)).toHaveText("시트 굵게");
  await expect(cell(page, 2, 0)).toHaveCSS("font-weight", "700");
  await expect(cell(page, 2, 1)).toHaveCSS("font-style", "italic");
});


test("M1-D10 셀 안 줄바꿈과 병합 칸을 살리고, 구글 문서의 굵지 않은 글은 굵게 바꾸지 않는다", async ({ context }) => {
  const page = await openSheet(context);
  // 시트·엑셀은 셀 안 줄바꿈을 HTML에선 <br>, 텍스트에선 따옴표로 담는다. 병합 칸은 colspan, 텍스트에선 빈 칸.
  await cell(page, 0, 0).click();
  await pasteHTML(
    page,
    '<table><tr><td colspan="2">병합</td><td style="font-weight:bold">굵게</td></tr><tr><td>줄1<br>줄2</td><td>b</td><td>c</td></tr></table>',
    '병합\t\t굵게\n"줄1\n줄2"\tb\tc',
  );
  await expect(cell(page, 0, 2)).toHaveText("굵게");
  await expect(cell(page, 0, 2)).toHaveCSS("font-weight", "700");
  await expect(cell(page, 0, 1)).toHaveText("");
  await expect(cell(page, 1, 0)).toHaveText("줄1\n줄2", { useInnerText: false });
  await expect(cell(page, 1, 1)).toHaveText("b");

  // 구글 문서는 굵지 않은 글도 <b style="font-weight:normal">로 감싼다 (2026-10-03 기준 형태)
  await cell(page, 3, 0).click();
  await pasteHTML(
    page,
    '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><span style="font-weight:400;">보통 글</span></b>',
    "보통 글",
  );
  await expect(cell(page, 3, 0)).toHaveText("보통 글");
  await expect(cell(page, 3, 0)).toHaveCSS("font-weight", "400");
});

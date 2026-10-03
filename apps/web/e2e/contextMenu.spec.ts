import { expect, test, type Page } from "@playwright/test";
import { MOD, cell, nameBox, openSheet, typeInto } from "./sheet";

// M3.5 우클릭 메뉴 (docs/manual-scenarios.md M3.5)

const menu = (page: Page) => page.getByRole("menu", { name: "셀 메뉴" });
// 항목 글자는 체크 + 이름 + 단축키다. "붙여넣기"처럼 다른 항목 이름에 들어가는 이름은 /^이름/으로 찾는다.
const menuItem = (page: Page, name: RegExp | string) =>
  menu(page).locator("[role^='menuitem']").filter({ hasText: name });

test("M3.5-1 셀 우클릭은 셀 메뉴, 선택 밖이면 그 셀로 옮기고 안이면 범위 유지", async ({ context }) => {
  const page = await openSheet(context);
  await cell(page, 1, 1).click();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowDown"); // B2:C3
  await cell(page, 2, 2).click({ button: "right" });
  await expect(menu(page)).toBeVisible();
  await expect(nameBox(page)).toHaveText("B2:C3");
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(page.getByLabel("셀 입력")).toBeFocused();

  await cell(page, 6, 4).click({ button: "right" });
  await expect(nameBox(page)).toHaveText("E7");
  await page.keyboard.press("Escape");

  await page.locator("[data-col='3']").first().click({ button: "right" }); // D열 머리글
  await expect(nameBox(page)).toHaveText("D1:D100");
});

test("M3.5-2 메뉴 복사·잘라내기·붙여넣기 — 키보드 붙여넣기와도 통한다", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "사과");
  await cell(page, 0, 0).click({ button: "right" });
  await menuItem(page, "복사").click();
  await expect(menu(page)).toHaveCount(0);
  await cell(page, 0, 1).click();
  await page.keyboard.press(`${MOD}+v`);
  await expect(cell(page, 0, 1)).toHaveText("사과");

  await cell(page, 0, 2).click({ button: "right" });
  await menuItem(page, /^붙여넣기/).click();
  await expect(cell(page, 0, 2)).toHaveText("사과");

  await cell(page, 0, 0).click({ button: "right" });
  await menuItem(page, "잘라내기").click();
  await expect(cell(page, 0, 0)).toHaveText("");
});

test("M3.5-3 서식은 현재 상태에 체크, 누르면 토글 / 내용 지우기는 서식을 남긴다", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "값");
  await cell(page, 0, 0).click({ button: "right" });
  await expect(menuItem(page, "굵게")).toHaveAttribute("aria-checked", "false");
  await menuItem(page, "굵게").click();
  await expect(cell(page, 0, 0)).toHaveCSS("font-weight", "700");
  await cell(page, 0, 0).click({ button: "right" });
  await expect(menuItem(page, "굵게")).toHaveAttribute("aria-checked", "true");
  await menuItem(page, "내용 지우기").click();
  await expect(cell(page, 0, 0)).toHaveText("");
  await page.keyboard.type("다시");
  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 0)).toHaveCSS("font-weight", "700");
});

test("M3.5-4 'AI로 편집…'은 선택 범위를 대상으로 AI 패널을 연다", async ({ context }) => {
  const page = await openSheet(context);
  await cell(page, 1, 1).click();
  await page.keyboard.press("Shift+ArrowDown");
  await cell(page, 1, 1).click({ button: "right" });
  await menuItem(page, "AI로 편집").click();
  await expect(page.getByLabel("AI에게 할 일")).toBeFocused();
  await expect(page.getByRole("complementary", { name: "AI 편집" })).toContainText("대상: B2:B3");
});

test("M3.5-5 Shift+F10으로 열고 방향키로 고르고 Enter로 실행", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "x");
  await cell(page, 0, 0).click();
  await page.keyboard.press("Shift+F10");
  await expect(menu(page)).toBeVisible();
  await expect(menuItem(page, "잘라내기")).toBeFocused();
  await page.keyboard.press("End"); // AI로 편집…
  await page.keyboard.press("ArrowUp"); // 밑줄
  await page.keyboard.press("Enter");
  await expect(cell(page, 0, 0)).toHaveCSS("text-decoration-line", "underline");
});

test("M3.5-6 셀 편집 중 우클릭은 셀 메뉴를 열지 않는다(글자 메뉴는 브라우저 몫)", async ({ context }) => {
  const page = await openSheet(context);
  await cell(page, 0, 0).click();
  await page.keyboard.type("편집 중");
  await page.getByLabel("셀 입력").click({ button: "right" });
  await expect(menu(page)).toHaveCount(0);
});

test("M3.5-7 클립보드 읽기 권한이 없으면 메뉴 붙여넣기는 키보드 붙여넣기를 안내한다", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] }); // 설정의 클립보드 권한을 물려받지 않은 브라우저
  const page = await openSheet(context);
  await cell(page, 0, 0).click({ button: "right" });
  await menuItem(page, /^붙여넣기/).click();
  // 권한을 묻는 중이면 허용 안내, 거절이면 붙여넣기 불가 안내 — 둘 다 ⌘V(Ctrl+V)를 알려 준다
  await expect(page.getByRole("status").filter({ hasText: /(⌘V|Ctrl\+V)/ })).toBeVisible();
  await context.close();
});

test("M3.5-8 화면 끝 셀을 우클릭해도 메뉴가 열려 있고, 화면 안쪽으로 펼쳐진다", async ({ context }) => {
  const page = await openSheet(context);
  await page.setViewportSize({ width: 1000, height: 520 });
  await cell(page, 15, 8).click({ button: "right" }); // 화면 오른쪽 아래 끝의 I16
  await expect(menu(page)).toBeVisible();
  const box = await menu(page).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(1000);
  expect(box!.y + box!.height).toBeLessThanOrEqual(520);
});

// 원본: A1 = "굵은 값"(굵게), 대상 C1 = "기울인 값"(기울임)
async function seedPasteSpecial(page: Page) {
  await typeInto(page, 0, 0, "굵은 값");
  await cell(page, 0, 0).click();
  await page.keyboard.press(`${MOD}+b`);
  await typeInto(page, 0, 2, "기울인 값");
  await cell(page, 0, 2).click();
  await page.keyboard.press(`${MOD}+i`);
  await cell(page, 0, 0).click();
  await page.keyboard.press(`${MOD}+c`);
}

test("M3.5-12 값만 붙여넣기는 대상 서식을 지키고, 서식만 붙여넣기는 값을 지킨다", async ({ context }) => {
  const page = await openSheet(context);
  await seedPasteSpecial(page);

  await cell(page, 0, 2).click({ button: "right" });
  await menuItem(page, "값만 붙여넣기").click();
  await expect(cell(page, 0, 2)).toHaveText("굵은 값");
  await expect(cell(page, 0, 2)).toHaveCSS("font-weight", "400");
  await expect(cell(page, 0, 2)).toHaveCSS("font-style", "italic");

  // 키보드 ⌘⇧V는 헤드리스 Chromium이 붙여넣기로 보내지 않아 수동 시나리오(M3.5-14)로 확인한다

  await page.keyboard.press(`${MOD}+z`);
  await cell(page, 0, 2).click({ button: "right" });
  await menuItem(page, "서식만 붙여넣기").click();
  await expect(cell(page, 0, 2)).toHaveText("기울인 값");
  await expect(cell(page, 0, 2)).toHaveCSS("font-weight", "700");
  await expect(cell(page, 0, 2)).toHaveCSS("font-style", "normal");
});

test("M3.5-13 서식 지우기(메뉴·⌘\\)는 값을 남기고 서식만 지운다", async ({ context }) => {
  const page = await openSheet(context);
  await seedPasteSpecial(page);
  await cell(page, 0, 0).click({ button: "right" });
  await menuItem(page, "서식 지우기").click();
  await expect(cell(page, 0, 0)).toHaveText("굵은 값");
  await expect(cell(page, 0, 0)).toHaveCSS("font-weight", "400");

  await cell(page, 0, 2).click();
  await page.keyboard.press(`${MOD}+Backslash`);
  await expect(cell(page, 0, 2)).toHaveText("기울인 값");
  await expect(cell(page, 0, 2)).toHaveCSS("font-style", "normal");
});

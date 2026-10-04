import { expect, test, type Page } from "@playwright/test";
import { MOD, cell, nameBox, openSheet, typeInto } from "./sheet";

// M1-I 셀 병합 (DESIGN.md 8절) — 엑셀의 "병합하고 가운데 맞춤"

const mergeButton = (page: Page) => page.getByRole("toolbar").getByRole("button", { name: "병합" });

async function selectRange(page: Page, from: [number, number], to: [number, number]) {
  await cell(page, ...from).click();
  await cell(page, ...to).click({ modifiers: ["Shift"] });
}

test("M1-I1·I4 값이 여러 칸이면 확인 후 왼쪽 위 값만 남기고 가운데 맞춤, 실행 취소 한 번에 돌아온다", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "제목");
  await typeInto(page, 0, 1, "지워짐");
  await selectRange(page, [0, 0], [1, 1]);

  page.once("dialog", (d) => void d.dismiss()); // 확인창에서 취소하면 그대로
  await mergeButton(page).click();
  await expect(cell(page, 0, 1)).toHaveText("지워짐");

  page.once("dialog", (d) => void d.accept());
  await mergeButton(page).click();
  await expect(cell(page, 0, 1)).toHaveCount(0); // 가려진 칸은 그리지 않는다
  await expect(cell(page, 0, 0)).toHaveText("제목");
  await expect(cell(page, 0, 0)).toHaveCSS("text-align", "center");
  await expect(nameBox(page)).toHaveText("A1");
  await expect(mergeButton(page)).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press(`${MOD}+z`);
  await expect(cell(page, 0, 1)).toHaveText("지워짐");
  await expect(cell(page, 0, 0)).toHaveCSS("text-align", "left");
});

test("M1-I2·I3 병합 칸은 한 칸처럼 선택·이동·입력하고, 다시 누르면 해제된다", async ({ context }) => {
  const page = await openSheet(context);
  await selectRange(page, [1, 1], [2, 2]); // B2:C3, 빈 칸이라 확인 없이
  await mergeButton(page).click();
  await expect(cell(page, 2, 2)).toHaveCount(0);

  await page.keyboard.type("병합칸");
  await page.keyboard.press("Enter");
  await expect(cell(page, 1, 1)).toHaveText("병합칸");
  await expect(nameBox(page)).toHaveText("B4"); // 병합 아래로

  await cell(page, 1, 1).click();
  await page.keyboard.press("ArrowRight");
  await expect(nameBox(page)).toHaveText("D2"); // 병합 너머로
  await page.keyboard.press("ArrowLeft");
  await expect(nameBox(page)).toHaveText("B2"); // 들어가면 왼쪽 위

  await cell(page, 1, 0).click();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(nameBox(page)).toHaveText("A2:C3"); // 병합 일부만 고를 수 없다

  await cell(page, 1, 1).click();
  await page.getByRole("toolbar").getByRole("button", { name: "병합" }).click();
  await expect(cell(page, 2, 2)).toBeVisible();
  await expect(cell(page, 1, 1)).toHaveText("병합칸");
  await expect(mergeButton(page)).toHaveAttribute("aria-pressed", "false");
});

test("M1-I5 병합 칸을 복사해 붙이면 병합도 함께 붙는다", async ({ context }) => {
  const page = await openSheet(context);
  await typeInto(page, 0, 0, "묶음");
  await selectRange(page, [0, 0], [0, 1]);
  await mergeButton(page).click();
  await cell(page, 0, 0).click();
  await page.keyboard.press(`${MOD}+c`);
  await cell(page, 4, 3).click();
  await page.keyboard.press(`${MOD}+v`);
  await expect(cell(page, 4, 3)).toHaveText("묶음");
  await expect(cell(page, 4, 4)).toHaveCount(0);
});

test("M1-I6 다른 탭에도 병합이 보이고, 긴 글은 병합 칸 앞에서 잘린다", async ({ context }) => {
  const a = await openSheet(context, "서연");
  const b = await openSheet(context, "준호");
  await typeInto(a, 4, 0, "병합 칸 앞에서 멈추는 아주 긴 글자입니다 계속");
  await selectRange(a, [4, 2], [4, 3]); // C5:D5
  await mergeButton(a).click();
  await expect(cell(b, 4, 3)).toHaveCount(0);
  const text = cell(b, 4, 0).locator("div").first();
  const width = (await text.boundingBox())?.width ?? 0;
  expect(width).toBeGreaterThan(150); // B5까지는 넘친다
  expect(width).toBeLessThan(210); // C5(병합)부터는 가린다
});

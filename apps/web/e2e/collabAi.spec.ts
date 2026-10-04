import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { MOD, cell, openSheet, typeInto } from "./sheet";

// M4 공동 편집 × AI (DESIGN.md 15절) — 같은 컨텍스트의 두 페이지 = 같은 브라우저의 두 탭, 가짜 응답

const panel = (page: Page) => page.getByRole("complementary", { name: "AI 편집" });
const proposal = (page: Page, row: number, col: number) => page.locator(`[data-proposal="${row}:${col}"]`);

async function seedColumn(page: Page, rows: number) {
  for (let r = 1; r <= rows; r++) await typeInto(page, r, 0, String(r * 100)); // A2부터 100, 200, …
}

async function ask(page: Page, startRow: number, rows: number, instruction: string) {
  await cell(page, startRow, 0).click();
  for (let i = 1; i < rows; i++) await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press(`${MOD}+k`);
  await page.getByLabel("AI에게 할 일").fill(instruction);
  await page.getByLabel("AI에게 할 일").press("Enter");
}

test("M4-X1 검토 중 다른 탭이 대상 칸을 고치면 그 칸은 건너뛰고 적용 — 다른 사람의 편집이 남는다", async ({ context }) => {
  const a = await openSheet(context, "서연");
  const b = await openSheet(context, "준호");
  await seedColumn(a, 2);
  await ask(a, 1, 2, "확인 표시"); // A2:A3
  await expect(panel(a).getByRole("button", { name: "적용", exact: true })).toBeVisible();

  await typeInto(b, 2, 0, "준호가 고침"); // 탭 B가 A3를 고침
  await expect(proposal(a, 2, 0)).toContainText("지금 준호가 고침 · 건너뜀");
  await panel(a).getByRole("button", { name: "바뀐 1칸 빼고 적용" }).click();
  for (const p of [a, b]) {
    await expect(cell(p, 1, 0)).toHaveText("100 ✓");
    await expect(cell(p, 2, 0)).toHaveText("준호가 고침");
  }
});

test("M4-X1 요청 뒤 제안이 도착하기 전에 바뀐 칸도 '원래 값이 바뀜'이다 (기준은 요청 순간)", async ({ context }) => {
  const a = await openSheet(context, "서연");
  const b = await openSheet(context, "준호");
  await seedColumn(a, 10);
  const key = randomUUID().replaceAll("-", "");
  await ask(a, 1, 10, `확인 표시 #gate=${key}`); // A2:A11 — 마지막 A11의 제안은 풀어 줄 때까지 오지 않는다
  await expect(proposal(a, 1, 0)).toBeVisible();
  await typeInto(b, 10, 0, "먼저 고침");
  await expect(cell(a, 10, 0)).toHaveText("먼저 고침"); // A11의 제안이 오기 전에 탭 A에 도착
  const release = await a.request.post("/api/ai", { data: { instruction: `#release=${key}`, context: "", scope: null, mock: true } });
  expect(release.ok()).toBe(true);
  await expect(panel(a).getByRole("button", { name: "바뀐 1칸 빼고 적용" })).toBeVisible();
  await expect(proposal(a, 10, 0)).toContainText("1000 ✓"); // AI는 요청 순간의 1000을 보고 계산했다
});

test("M4-X1 모든 칸이 바뀌면 적용할 것이 없다고 알리고 적용 버튼을 잠근다", async ({ context }) => {
  const a = await openSheet(context, "서연");
  const b = await openSheet(context, "준호");
  await seedColumn(a, 2);
  await cell(a, 1, 0).click(); // A2 한 칸만 — 한 칸 선택의 기본 대상은 시트 전체라 [선택 범위만]으로 바꾼다
  await a.keyboard.press(`${MOD}+k`);
  await panel(a).getByRole("button", { name: "선택 범위만" }).click();
  await a.getByLabel("AI에게 할 일").fill("확인 표시");
  await a.getByLabel("AI에게 할 일").press("Enter");
  await expect(panel(a).getByRole("button", { name: "적용", exact: true })).toBeVisible();
  await typeInto(b, 1, 0, "바뀜");
  await expect(panel(a)).toContainText("모든 칸의 원래 값이 바뀌었어요. 지금 값으로 다시 요청해 주세요.");
  await expect(panel(a).getByRole("button", { name: "적용", exact: true })).toBeDisabled();
});

test("M4-X3 겹치는 범위에 요청하려 하면 알리고, 막지는 않는다", async ({ context }) => {
  const a = await openSheet(context, "서연");
  const b = await openSheet(context, "준호");
  await seedColumn(a, 4);
  await ask(a, 1, 2, "확인 표시"); // 서연: A2:A3 검토 중
  await expect(panel(a).getByRole("button", { name: "적용", exact: true })).toBeVisible({ timeout: 10_000 });

  await cell(b, 2, 0).click();
  await b.keyboard.press("Shift+ArrowDown"); // 준호: A3:A4 — A3이 겹친다
  await b.keyboard.press(`${MOD}+k`);
  await expect(panel(b)).toContainText("서연님이 A2:A3 범위를 AI로 검토하는 중이에요. 겹치는 칸은 먼저 적용한 쪽이 반영돼요.");
  await b.getByLabel("AI에게 할 일").fill("확인 표시");
  await b.getByLabel("AI에게 할 일").press("Enter");
  await expect(panel(b).getByRole("button", { name: "적용", exact: true })).toBeVisible({ timeout: 10_000 }); // 막지 않는다

  // 서연이 먼저 적용하면 준호의 A3 제안은 '원래 값이 바뀜'이 되어 건너뛴다
  await panel(a).getByRole("button", { name: "적용", exact: true }).click();
  await panel(b).getByRole("button", { name: "바뀐 1칸 빼고 적용" }).click();
  await expect(cell(b, 2, 0)).toHaveText("200 ✓"); // 서연의 결과
  await expect(cell(b, 3, 0)).toHaveText("300 ✓"); // 준호의 결과
});

test("M4-X3 겹치지 않는 범위에는 경고가 없다", async ({ context }) => {
  const a = await openSheet(context, "서연");
  const b = await openSheet(context, "준호");
  await seedColumn(a, 4);
  await ask(a, 1, 2, "확인 표시"); // A2:A3
  await expect(panel(a).getByRole("button", { name: "적용", exact: true })).toBeVisible();
  await cell(b, 3, 0).click();
  await b.keyboard.press("Shift+ArrowDown"); // A4:A5
  await b.keyboard.press(`${MOD}+k`);
  await expect(b.getByLabel("AI에게 할 일")).toBeFocused();
  await expect(panel(b)).not.toContainText("겹치는 칸은");
});

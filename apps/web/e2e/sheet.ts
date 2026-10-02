import { expect, type BrowserContext, type Page } from "@playwright/test";

// 시나리오 공용 조작. 시나리오 ID는 docs/manual-scenarios.md.

export const MOD = "ControlOrMeta";

export function cell(page: Page, row: number, col: number) {
  return page.locator(`[data-row="${row}"][data-col="${col}"]`).first();
}

export const nameBox = (page: Page) => page.getByLabel("선택한 셀");
export const myAvatar = (page: Page) => page.locator('button[popovertarget="participant-panel"]');

// 시트를 열고, 이름 입력 화면이 뜨면 이름을 정한다. 이름이 이미 저장된 브라우저(컨텍스트)면 바로 연다.
export async function openSheet(context: BrowserContext, name = "테스터"): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/");
  const dialog = page.locator("dialog[open]");
  const grid = page.getByLabel("셀 입력");
  await expect(dialog.or(grid).first()).toBeVisible();
  if (await dialog.isVisible()) {
    await dialog.getByLabel("이름").fill(name);
    await dialog.getByRole("button", { name: "시작하기" }).click();
  }
  await expect(myAvatar(page)).toBeVisible();
  return page;
}

export async function typeInto(page: Page, row: number, col: number, text: string) {
  await cell(page, row, col).click();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

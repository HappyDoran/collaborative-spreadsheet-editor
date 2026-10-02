import { expect, test, type Page } from "@playwright/test";
import { MOD, cell, myAvatar, nameDialog, openSheet, typeInto } from "./sheet";

// M2 공동 편집 — 같은 컨텍스트의 페이지 = 같은 브라우저의 탭 (docs/manual-scenarios.md M2)

const colorOf = (p: Page) => myAvatar(p).evaluate((el) => getComputedStyle(el).backgroundColor);

test("M2-N1·N2 첫 접속 이름 지정: Esc 불가, 빈 이름 거부, 아바타 색 = 셀 포인터 색", async ({ context }) => {
  const page = await context.newPage();
  await page.goto("/");
  const dialog = nameDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("이름")).toHaveValue(""); // 처음 쓰는 브라우저는 기본값 없음
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByText("이름을 한 글자 이상 입력하세요.")).toBeVisible();

  await dialog.getByLabel("이름").fill("  김서연 ");
  await dialog.getByRole("button", { name: "시작하기" }).click();
  await expect(dialog).toBeHidden();
  await expect(myAvatar(page)).toHaveText("김");
  await expect(page.getByLabel("셀 입력")).toHaveCSS("border-top-color", await colorOf(page));
});

test("M2-N3 새로고침해도 이 탭의 이름·색이 유지되고 이름 화면이 다시 뜨지 않는다", async ({ context }) => {
  const page = await openSheet(context, "김서연");
  const color = await colorOf(page);
  await page.reload();
  await expect(myAvatar(page)).toHaveText("김");
  await expect(nameDialog(page)).toHaveCount(0);
  expect(await colorOf(page)).toBe(color);
});

test("M2-N4·C1·C2 새 탭: 마지막 이름이 미리 채워진 이름 화면, 같은 이름 허용·다른 색, 합류 시 내용, 실시간", async ({ context }) => {
  const a = await openSheet(context, "김서연");
  await typeInto(a, 0, 0, "from A");

  const b = await context.newPage();
  await b.goto("/");
  await expect(nameDialog(b).getByLabel("이름")).toHaveValue("김서연");
  await nameDialog(b).getByRole("button", { name: "시작하기" }).click();
  await expect(myAvatar(b)).toHaveText("김");
  expect(await colorOf(a)).not.toBe(await colorOf(b));
  await expect(cell(b, 0, 0)).toHaveText("from A");

  await typeInto(b, 1, 1, "from B");
  await expect(cell(a, 1, 1)).toHaveText("from B");
});

test("M2-C3 같은 셀에 값과 서식을 동시에 바꾸면 둘 다 남는다", async ({ context }) => {
  const a = await openSheet(context);
  const b = await openSheet(context);
  await cell(a, 5, 0).click();
  await cell(b, 5, 0).click();
  await Promise.all([a.keyboard.type("동시"), b.keyboard.press(`${MOD}+b`)]);
  await a.keyboard.press("Enter");
  for (const p of [a, b]) {
    await expect(cell(p, 5, 0)).toHaveText("동시");
    await expect(cell(p, 5, 0)).toHaveCSS("font-weight", "700");
  }
});

test("M2-C4 참여자 목록: 탭마다 따로, 같은 이름은 그대로", async ({ context }) => {
  const a = await openSheet(context, "민지");
  await openSheet(context, "민지");
  await openSheet(context, "준");
  await myAvatar(a).click();
  const rows = a.locator("#participant-panel li");
  await expect(a.locator("#participant-panel")).toContainText("접속 중 3명");
  // 나는 맨 앞, 나머지 순서는 정하지 않는다
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("민지 (나)");
  await expect(rows.filter({ hasText: /^.민지A1/ })).toHaveCount(1); // 다른 탭의 같은 이름이 번호 없이 그대로
  await expect(rows.filter({ hasText: "준" })).toHaveCount(1);
});

test("M2-C5 다른 탭의 선택 범위와 입력 중 셀이 보인다", async ({ context }) => {
  const a = await openSheet(context, "서연");
  const b = await openSheet(context, "준호");
  // 닫힌 참여자 목록에도 같은 이름이 있으므로 화면에 보이는 이름표만 본다
  const tag = (text: string) => a.getByText(text, { exact: true }).filter({ visible: true });
  await cell(b, 3, 2).click();
  await b.keyboard.press("Shift+ArrowDown");
  await expect(tag("준호")).toBeVisible();
  await b.keyboard.type("x");
  await expect(tag("준호 · 입력 중")).toBeVisible();
  await b.keyboard.press("Escape");
  await expect(tag("준호")).toBeVisible();
});

test("M2-C6 탭을 닫으면 목록에서 바로 사라진다", async ({ context }) => {
  const a = await openSheet(context);
  await openSheet(context);
  const c = await openSheet(context);
  await expect(myAvatar(a)).toHaveAttribute("aria-label", /접속 중 3명/);
  await c.close();
  await expect(myAvatar(a)).toHaveAttribute("aria-label", /접속 중 2명/, { timeout: 2000 });
});

test("M2-C7 실행 취소는 내 변경만 되돌린다", async ({ context }) => {
  const a = await openSheet(context);
  const b = await openSheet(context);
  await typeInto(a, 7, 0, "A의 값");
  await typeInto(b, 7, 1, "B의 값");
  await expect(cell(a, 7, 1)).toHaveText("B의 값");
  await a.keyboard.press(`${MOD}+z`);
  for (const p of [a, b]) {
    await expect(cell(p, 7, 0)).toHaveText("");
    await expect(cell(p, 7, 1)).toHaveText("B의 값");
  }
});

test("M2-N5·N7 이름 바꾸기·지우기는 그 탭에만, 바꾼 이름은 다음 새 탭의 기본값", async ({ context }) => {
  const a = await openSheet(context, "김서연");
  const b = await openSheet(context, "김서연");
  const panel = a.locator("#participant-panel");

  await myAvatar(a).click();
  await panel.getByRole("button", { name: "이름 바꾸기" }).click();
  await panel.getByLabel("새 이름").fill("이준");
  await panel.getByRole("button", { name: "저장" }).click();
  await expect(myAvatar(a)).toHaveText("이");
  await expect(myAvatar(b)).toHaveText("김");
  await expect(myAvatar(b)).toHaveAttribute("aria-label", /접속 중 2명/);
  await myAvatar(b).click();
  await expect(b.locator("#participant-panel")).toContainText("이준");
  await b.keyboard.press("Escape");

  const c = await context.newPage();
  await c.goto("/");
  await expect(nameDialog(c).getByLabel("이름")).toHaveValue("이준");
  await c.close();

  await panel.getByRole("button", { name: "이름 지우기" }).click();
  await expect(nameDialog(a)).toBeVisible();
  await expect(nameDialog(b)).toHaveCount(0);
  await expect(myAvatar(b)).toHaveAttribute("aria-label", /접속 중 1명/);
});

import { expect, test, type Page } from "@playwright/test";
import { MOD, cell, nameBox, openSheet, typeInto } from "./sheet";

// M3 AI 편집 — 개발 서버는 가짜 응답 모드로 시작한다 (크레딧을 쓰지 않고 결과가 매번 같다).
// 가짜 응답: 대상 셀마다 "값 ✓"(빈 칸은 "✓ 주소"). 지시의 #slow #empty #outside #quota #invalid로 상황을 흉내 낸다.

const panel = (page: Page) => page.getByRole("complementary", { name: "AI 편집" });
const proposal = (page: Page, row: number, col: number) => page.locator(`[data-proposal="${row}:${col}"]`);

async function seed(page: Page) {
  await typeInto(page, 1, 0, "1000");
  await typeInto(page, 2, 0, "2500");
  await cell(page, 1, 0).click();
  await page.keyboard.press("Shift+ArrowDown"); // A2:A3
}

// 생성 중 상태를 붙잡아야 하는 시나리오는 대상을 A2:A11(10칸)로 넓혀 #slow 생성이 5초쯤 걸리게 한다
async function widen(page: Page) {
  for (let i = 0; i < 8; i++) await page.keyboard.press("Shift+ArrowDown");
}

async function ask(page: Page, instruction: string) {
  await page.keyboard.press(`${MOD}+k`);
  const input = page.getByLabel("AI에게 할 일");
  await expect(input).toBeFocused();
  await input.fill(instruction);
  await input.press("Enter");
}

test("M3-1 대상 표시: 여러 칸이면 선택 범위, 한 칸이면 시트 전체, 전환 가능", async ({ context }) => {
  const page = await openSheet(context);
  await page.keyboard.press(`${MOD}+k`);
  await expect(panel(page)).toContainText("대상: 시트 전체");
  await cell(page, 1, 1).click();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(panel(page)).toContainText("대상: B2:C2");
  await panel(page).getByRole("button", { name: "시트 전체" }).click();
  await expect(panel(page)).toContainText("대상: 시트 전체");
});

test("M3-2 셀 단위 스트리밍 → 미리보기 → 적용 → 실행 취소 한 번", async ({ context }) => {
  const page = await openSheet(context);
  await seed(page);
  await widen(page);
  await ask(page, "확인 표시 #slow");
  await expect(proposal(page, 1, 0)).toContainText("1000 ✓", { timeout: 10_000 });
  await expect(panel(page).getByText(/셀을 채우는 중… \d+개/)).toBeVisible();
  await expect(panel(page).getByText("미리보기예요. 아직 시트에 적용되지 않았어요.")).toBeVisible();
  await expect(cell(page, 1, 0)).toHaveText("1000"); // 미리보기 동안 시트는 그대로
  await expect(page.getByText("AI 제안: 1000 ✓")).toBeVisible(); // 값 편집줄

  await panel(page).getByRole("button", { name: "적용", exact: true }).click();
  await expect(cell(page, 1, 0)).toHaveText("1000 ✓");
  await expect(cell(page, 2, 0)).toHaveText("2500 ✓");
  await expect(panel(page)).toContainText("10개 셀에 적용했어요. ⌘Z로 한 번에 되돌릴 수 있어요.");
  await expect(cell(page, 10, 0)).toHaveText("✓ A11");
  await expect(proposal(page, 1, 0)).toHaveCount(0);

  await page.keyboard.press(`${MOD}+z`); // 포커스가 그리드로 돌아와 있어야 한다
  await expect(cell(page, 1, 0)).toHaveText("1000");
  await expect(cell(page, 2, 0)).toHaveText("2500");
  await expect(cell(page, 10, 0)).toHaveText("");
});

test("M3-3 생성 중 중지하면 받은 셀까지 버리고 시트는 그대로", async ({ context }) => {
  const page = await openSheet(context);
  await seed(page);
  await widen(page);
  await ask(page, "확인 표시 #slow");
  await expect(proposal(page, 1, 0)).toBeVisible();
  await panel(page).getByRole("button", { name: "중지" }).click();
  await expect(panel(page)).toContainText("생성을 멈췄어요. 시트는 바뀌지 않았어요.");
  await expect(page.locator("[data-proposal]")).toHaveCount(0);
  await expect(cell(page, 1, 0)).toHaveText("1000");
});

test("M3-4 버리기", async ({ context }) => {
  const page = await openSheet(context);
  await seed(page);
  await ask(page, "확인 표시");
  await panel(page).getByRole("button", { name: "버리기", exact: true }).click();
  await expect(panel(page)).toContainText("제안을 버렸어요.");
  await expect(page.locator("[data-proposal]")).toHaveCount(0);
  await expect(cell(page, 1, 0)).toHaveText("1000");
});

test("M3-5 바꿀 셀이 없으면 검토 없이 답만, 대상 밖 제안은 제외 안내", async ({ context }) => {
  const page = await openSheet(context);
  await seed(page);
  await ask(page, "요약 #empty");
  await expect(panel(page)).toContainText("AI는 셀을 바꾸지 않았어요.");
  await expect(panel(page).getByRole("button", { name: "적용", exact: true })).toHaveCount(0);

  await panel(page).getByLabel("AI에게 할 일").fill("확인 표시 #outside");
  await panel(page).getByLabel("AI에게 할 일").press("Enter");
  await expect(panel(page)).toContainText("대상 범위 밖이거나 주소가 잘못된 제안 2개는 제외했어요.");
  await expect(proposal(page, 99, 25)).toHaveCount(0); // Z100
  await expect(proposal(page, 1, 0)).toBeVisible();
});

test("M3-6 실패: 한도 소진은 다시 시도 없음, 형식 오류는 다시 시도", async ({ context }) => {
  const page = await openSheet(context);
  await seed(page);
  await ask(page, "x #quota");
  await expect(panel(page)).toContainText("지금은 AI를 쓸 수 없어요(사용 한도 도달). 시트 편집은 계속할 수 있어요.");
  await expect(panel(page).getByRole("button", { name: "다시 시도" })).toHaveCount(0);

  await panel(page).getByLabel("AI에게 할 일").fill("x #invalid");
  await panel(page).getByLabel("AI에게 할 일").press("Enter");
  await expect(panel(page)).toContainText("AI 결과를 읽지 못했어요.");
  await expect(panel(page).getByRole("button", { name: "다시 시도" })).toBeVisible();
  await expect(page.locator("[data-proposal]")).toHaveCount(0);
});

test("M3-7 검토 중 원래 값이 바뀌면 표시하고 '그래도 적용'", async ({ context }) => {
  const page = await openSheet(context);
  await seed(page);
  await ask(page, "확인 표시");
  await expect(panel(page).getByRole("button", { name: "적용", exact: true })).toBeVisible();
  await typeInto(page, 2, 0, "9999"); // 검토 중 A3를 직접 고침
  await expect(panel(page)).toContainText("1개 셀의 원래 값이 검토하는 동안 바뀌었어요.");
  await panel(page).getByRole("button", { name: "그래도 적용" }).click();
  await expect(cell(page, 2, 0)).toHaveText("2500 ✓");
});

test("M3-8 ⌘K로 열고 닫기, Esc는 그리드로", async ({ context }) => {
  const page = await openSheet(context);
  await page.keyboard.press(`${MOD}+k`);
  await expect(page.getByLabel("AI에게 할 일")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("셀 입력")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(nameBox(page)).toHaveText("A2");
  await page.keyboard.press(`${MOD}+k`);
  await expect(page.getByLabel("AI에게 할 일")).toBeFocused(); // 입력칸에 있을 때 다시 누르면 닫힌다
  await page.keyboard.press(`${MOD}+k`);
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByLabel("셀 입력")).toBeFocused();
});

test("M3-9 제안 셀을 눌러도 결정 버튼은 패널에만, 위치 보기는 선택을 바꾸지 않는다", async ({ context }) => {
  const page = await openSheet(context);
  await seed(page);
  await ask(page, "확인 표시");
  await expect(panel(page)).toContainText("제안 2개");
  await cell(page, 2, 0).click();
  await expect(page.getByRole("button", { name: "적용", exact: true })).toHaveCount(1); // 셀 옆 버튼 없음
  await panel(page).getByRole("button", { name: "위치 보기" }).click();
  await expect(nameBox(page)).toHaveText("A3");
});

test("M3-10 새로고침해도 검토 중인 제안이 남는다, 생성 중 새로고침은 멈춤 안내", async ({ context }) => {
  const page = await openSheet(context);
  await seed(page);
  await ask(page, "확인 표시");
  await expect(proposal(page, 1, 0)).toBeVisible();
  await page.reload();
  await expect(proposal(page, 1, 0)).toContainText("1000 ✓");
  await expect(panel(page).getByRole("button", { name: "적용", exact: true })).toBeVisible();
  await panel(page).getByRole("button", { name: "버리기", exact: true }).click();

  await cell(page, 1, 0).click();
  await page.keyboard.press("Shift+ArrowDown");
  await widen(page);
  await panel(page).getByLabel("AI에게 할 일").fill("확인 표시 #slow");
  await panel(page).getByLabel("AI에게 할 일").press("Enter");
  await expect(proposal(page, 1, 0)).toBeVisible();
  await page.reload();
  await expect(panel(page)).toContainText("새로고침으로 생성이 멈췄어요.");
  await expect(page.locator("[data-proposal]")).toHaveCount(0);
});

test("M3-11 다른 탭에는 제안 값 대신 'AI 생성 중·검토 중' 범위와 이름만 보인다", async ({ context }) => {
  const a = await openSheet(context, "서연");
  const b = await openSheet(context, "준호");
  await seed(a);
  await widen(a);
  await ask(a, "확인 표시 #slow");
  await expect(b.getByText("서연 · AI 생성 중")).toBeVisible();
  await expect(a.locator("[data-proposal]").first()).toBeVisible();
  await expect(b.locator("[data-proposal]")).toHaveCount(0); // 제안 값은 공유하지 않는다
  await expect(b.getByText("서연 · AI 검토 중")).toBeVisible({ timeout: 10_000 });
  await a.getByRole("complementary", { name: "AI 편집" }).getByRole("button", { name: "버리기", exact: true }).click();
  await expect(b.getByText(/서연 · AI/)).toHaveCount(0);
});

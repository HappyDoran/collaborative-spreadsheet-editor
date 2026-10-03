import { defineConfig, devices } from "@playwright/test";

// 다중 탭 E2E. 테스트마다 새 브라우저 컨텍스트 = 빈 localStorage·IndexedDB로 시작한다.
// 같은 컨텍스트의 페이지끼리는 BroadcastChannel·IndexedDB를 공유하므로 "같은 브라우저의 여러 탭"이 된다.
export const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  // dev 서버는 라우트를 첫 요청 때 컴파일한다. 병렬 테스트가 그 순간 /api/ai에 몰리면 응답이 기대 시간을 넘긴다 — 미리 한 번 부른다.
  globalSetup: "./e2e/warmup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1280, height: 760 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});

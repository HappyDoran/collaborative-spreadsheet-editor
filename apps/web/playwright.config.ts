import { defineConfig, devices } from "@playwright/test";

// 다중 탭 E2E. 테스트마다 새 브라우저 컨텍스트 = 빈 localStorage·IndexedDB로 시작한다.
// 같은 컨텍스트의 페이지끼리는 BroadcastChannel·IndexedDB를 공유하므로 "같은 브라우저의 여러 탭"이 된다.
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
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

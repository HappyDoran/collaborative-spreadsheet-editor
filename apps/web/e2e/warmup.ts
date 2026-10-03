import { PORT } from "../playwright.config";

// 테스트 전에 페이지와 AI 라우트를 한 번씩 불러 dev 서버의 첫 컴파일을 끝내 둔다 (playwright.config.ts globalSetup).
export default async function warmup() {
  const base = `http://localhost:${PORT}`;
  await (await fetch(base)).text();
  const body = JSON.stringify({ instruction: "warmup #empty", context: "", scope: null, mock: true });
  await (await fetch(`${base}/api/ai`, { method: "POST", headers: { "Content-Type": "application/json" }, body })).text();
}

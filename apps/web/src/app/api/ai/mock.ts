import { parseA1, resolveModel, toA1, forEachAddress, inScope, type AiErrorCode, type AiItem, type AiRequestBody } from "@sheet/core";

// 가짜 응답 (DESIGN.md 13절). 크레딧 없이 실제와 같은 항목 흐름을 시간차로 낸다 — 자동 테스트와 디버깅용.
// 지시에 다음 표시가 있으면 해당 상황을 흉내 낸다: #quota(한도 소진) #invalid(형식 오류) #empty(바꿀 셀 없음)
// #outside(대상 밖·잘못된 주소 섞기) #slow(항목 사이 0.5초) #hold(첫 제안 뒤 요청이 끊길 때까지 생성 중으로 머묾)
// #gate=<키>(마지막 제안 앞에서 #release=<키> 요청이 올 때까지 머묾 — 테스트가 생성 도중에 다른 탭의 편집을 끼워 넣는다)
// 이 라우트가 알고 던지는 실패 — 코드 그대로 브라우저에 보낸다
export class Failure extends Error {
  constructor(readonly code: AiErrorCode) {
    super(code);
  }
}

const MAX_MOCK_EDITS = 30;

// 키별 문. 풀기 요청이 먼저 와도 열린 채 남아 있게 먼저 온 쪽이 만든다. ponytail: 풀지 않은 키는 dev 서버가 살아 있는 동안 남는다
const gates = new Map<string, { opened: Promise<void>; open: () => void }>();
function gate(key: string) {
  let entry = gates.get(key);
  if (!entry) {
    let open!: () => void;
    const opened = new Promise<void>((resolve) => (open = resolve));
    gates.set(key, (entry = { opened, open }));
  }
  return entry;
}

export async function* mockItems(body: AiRequestBody, signal: AbortSignal): AsyncGenerator<AiItem> {
  const has = (tag: string) => body.instruction.includes(tag);
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
    });
  const until = (opened: Promise<void>) =>
    new Promise<void>((resolve, reject) => {
      void opened.then(resolve);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  const gap = has("#slow") ? 500 : 120;
  const gateKey = /#gate=(\w+)/.exec(body.instruction)?.[1];
  const releaseKey = /#release=(\w+)/.exec(body.instruction)?.[1];
  if (releaseKey) return gate(releaseKey).open();

  await wait(gap);
  if (has("#quota")) throw new Failure("quota");
  yield { kind: "reply", cell: "", text: `가짜 응답이에요(${resolveModel(body.model)}). 대상 셀 값 뒤에 ✓를 붙여 볼게요.` };
  if (has("#empty")) return;

  const known = new Map<string, string>();
  for (const line of body.context.split("\n")) {
    const m = /^([A-Z]+\d+): (.*)$/.exec(line);
    if (m) known.set(m[1]!, JSON.parse(m[2]!) as string);
  }
  const targets: string[] = [];
  if (body.scope) forEachAddress(body.scope, (addr) => void targets.push(toA1(addr)));
  else targets.push(...known.keys());

  if (has("#outside")) yield* [
    { kind: "edit" as const, cell: "Z100", text: "범위 밖" },
    { kind: "edit" as const, cell: "합계", text: "주소 아님" },
  ].filter((item) => !body.scope || !inScope(parseA1(item.cell) ?? { row: -1, col: -1 }, body.scope));

  const cells = targets.slice(0, MAX_MOCK_EDITS);
  for (const [i, cell] of cells.entries()) {
    if (gateKey && i === cells.length - 1) await until(gate(gateKey).opened).finally(() => gates.delete(gateKey));
    await wait(gap);
    if (has("#invalid")) throw new Failure("invalid");
    const before = known.get(cell) ?? "";
    yield { kind: "edit", cell, text: before ? `${before} ✓` : `✓ ${cell}` };
    if (has("#hold")) await until(new Promise(() => {})); // 중지·새로고침으로만 끝난다
  }
}

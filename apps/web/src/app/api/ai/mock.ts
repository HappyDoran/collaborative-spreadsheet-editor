import { parseA1, resolveModel, toA1, forEachAddress, inScope, type AiItem, type AiRequestBody } from "@sheet/core";

// 가짜 응답 (DESIGN.md 13절). 크레딧 없이 실제와 같은 항목 흐름을 시간차로 낸다 — 자동 테스트와 디버깅용.
// 지시에 다음 표시가 있으면 해당 상황을 흉내 낸다: #quota(한도 소진) #invalid(형식 오류) #empty(바꿀 셀 없음)
// #outside(대상 밖·잘못된 주소 섞기) #slow(항목 사이 0.5초)
export class MockFailure extends Error {
  constructor(readonly code: "quota" | "invalid") {
    super(code);
  }
}

const MAX_MOCK_EDITS = 30;

export async function* mockItems(body: AiRequestBody, signal: AbortSignal): AsyncGenerator<AiItem> {
  const has = (tag: string) => body.instruction.includes(tag);
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
    });
  const gap = has("#slow") ? 500 : 120;

  await wait(gap);
  if (has("#quota")) throw new MockFailure("quota");
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

  for (const cell of targets.slice(0, MAX_MOCK_EDITS)) {
    await wait(gap);
    if (has("#invalid")) throw new MockFailure("invalid");
    const before = known.get(cell) ?? "";
    yield { kind: "edit", cell, text: before ? `${before} ✓` : `✓ ${cell}` };
  }
}

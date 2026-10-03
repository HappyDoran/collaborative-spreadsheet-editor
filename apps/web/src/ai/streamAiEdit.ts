import type { AiRequestBody, AiStreamEvent } from "@sheet/core";

// 서버의 NDJSON 스트림을 이벤트로 읽는다. React·시트 상태를 모른다 — 수명주기(시작·수신·중지·실패)만 다룬다.
export const IDLE_TIMEOUT_MS = 20_000; // 이 시간 동안 아무것도 오지 않으면 실패 (DESIGN.md 13절)

export class AbortedByUser extends Error {}

// 끝나면(done/error 포함) 정상 반환. 사용자가 중지하면 AbortedByUser를 던진다.
export async function streamAiEdit(
  body: AiRequestBody,
  { signal, onEvent }: { signal: AbortSignal; onEvent: (event: AiStreamEvent) => void },
): Promise<void> {
  const idle = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resetIdle = () => {
    clearTimeout(timer);
    timer = setTimeout(() => idle.abort(), IDLE_TIMEOUT_MS);
  };
  const fail = (code: "network" | "timeout") => onEvent({ type: "error", code });

  resetIdle();
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, idle.signal]),
    });
    if (!response.body) return fail("network");
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      resetIdle();
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as AiStreamEvent;
        onEvent(event);
        if (event.type === "done" || event.type === "error") return;
      }
    }
    fail("network"); // done 없이 끊김
  } catch {
    if (signal.aborted) throw new AbortedByUser();
    fail(idle.signal.aborted ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}

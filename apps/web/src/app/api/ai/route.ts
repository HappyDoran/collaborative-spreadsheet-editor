import { openai } from "@ai-sdk/openai";
import { APICallError, Output, jsonSchema, streamText } from "ai";
import type { AiErrorCode, AiItem, AiRequestBody, AiStreamEvent } from "@sheet/core";
import { MockFailure, mockItems } from "./mock";
import { SYSTEM_PROMPT, buildPrompt } from "./prompt";

// AI 편집 서버 라우트. 브라우저에는 NDJSON(한 줄에 이벤트 하나)으로 흘려보낸다 (DESIGN.md 13절).
// 키는 서버 환경 변수로만 읽는다 (TECH_RULES.md 5절).

const MODEL = "gpt-5.4-mini";
const MAX_INSTRUCTION_CHARS = 1_000;
const MAX_CONTEXT_CHARS = 60_000; // 셀 600개 상한(sheetContext)과 별개로 문자 수도 막는다
const MAX_OUTPUT_TOKENS = 6_000;
const SILENCE_MS = 20_000; // 이 시간 동안 출력이 없으면 실패 — 브라우저의 무응답 판정과 같다

export const maxDuration = 120;

const ITEM_SCHEMA = jsonSchema<AiItem>({
  type: "object",
  properties: {
    kind: { type: "string", enum: ["reply", "edit"] },
    cell: { type: "string", description: "edit이면 A1 형식 주소, reply면 빈 문자열" },
    text: { type: "string", description: "reply면 사용자에게 할 말, edit이면 셀의 새 값 전체" },
  },
  required: ["kind", "cell", "text"],
  additionalProperties: false,
});

class Failure extends Error {
  constructor(readonly code: AiErrorCode) {
    super(code);
  }
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (typeof body === "string") return ndjson([{ type: "error", code: body }], body === "too_large" ? 413 : 400);

  const items = body.mock ? mockItems(body, request.signal) : modelItems(body, request.signal);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AiStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const item of items) {
          if (item.kind === "reply") send({ type: "reply", text: item.text });
          else send({ type: "edit", cell: item.cell, value: item.text });
        }
        send({ type: "done" });
      } catch (error) {
        // 브라우저가 중지·이탈해 끊긴 경우는 받을 사람이 없다
        if (!request.signal.aborted) send({ type: "error", code: errorCode(error) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}

async function* modelItems(body: AiRequestBody, signal: AbortSignal): AsyncGenerator<AiItem> {
  if (!process.env.OPENAI_API_KEY) throw new Failure("config");
  let streamError: unknown = null;
  const result = streamText({
    model: openai(MODEL),
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(body),
    output: Output.array({ element: ITEM_SCHEMA }),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: signal, // 중지하면 OpenAI 호출까지 끊는다
    timeout: { firstChunkMs: SILENCE_MS, chunkMs: SILENCE_MS },
    providerOptions: { openai: { reasoningEffort: "low", reasoningSummary: null } },
    onError: ({ error }) => {
      streamError = error;
    },
  });
  for await (const item of result.elementStream) yield item;
  if (streamError) throw streamError;
}

async function readBody(request: Request): Promise<AiRequestBody | AiErrorCode> {
  let body: AiRequestBody;
  try {
    body = await request.json();
  } catch {
    return "invalid";
  }
  if (typeof body?.instruction !== "string" || typeof body.context !== "string" || !body.instruction.trim()) {
    return "invalid";
  }
  if (body.instruction.length > MAX_INSTRUCTION_CHARS || body.context.length > MAX_CONTEXT_CHARS) return "too_large";
  return body;
}

function errorCode(error: unknown): AiErrorCode {
  if (error instanceof Failure || error instanceof MockFailure) return error.code;
  // 재시도 끝에 실패하면 마지막 오류가 감싸여 온다
  const cause = (error as { lastError?: unknown })?.lastError ?? error;
  if (APICallError.isInstance(cause)) {
    const body = cause.responseBody ?? "";
    if (cause.statusCode === 401 || cause.statusCode === 403) return "config";
    if (cause.statusCode === 429) return body.includes("insufficient_quota") ? "quota" : "rate";
    if (cause.statusCode === 400 && body.includes("context_length")) return "too_large";
    return "upstream";
  }
  const name = (cause as Error)?.name ?? "";
  if (/Timeout/i.test(name)) return "timeout";
  if (/JSONParse|TypeValidation|NoObjectGenerated|NoOutput/i.test(name)) return "invalid";
  return "upstream";
}

function ndjson(events: AiStreamEvent[], status: number) {
  return new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(""), {
    status,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}

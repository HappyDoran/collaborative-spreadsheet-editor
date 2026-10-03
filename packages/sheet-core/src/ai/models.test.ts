import { describe, expect, it } from "vitest";
import { AI_MODELS, DEFAULT_AI_MODEL, resolveModel } from "./models";

describe("resolveModel", () => {
  it("목록의 모델은 그대로", () => {
    for (const m of AI_MODELS) expect(resolveModel(m.id)).toBe(m.id);
  });

  it("목록에 없는 값은 기본 모델 — 임의 모델명으로 비싼 모델을 부를 수 없다", () => {
    for (const bad of [undefined, null, "", "gpt-5.4-pro", "GPT-5.4", 42]) expect(resolveModel(bad)).toBe(DEFAULT_AI_MODEL);
  });

  it("기본 모델은 목록에 있다", () => {
    expect(AI_MODELS.map((m) => m.id)).toContain(DEFAULT_AI_MODEL);
  });
});

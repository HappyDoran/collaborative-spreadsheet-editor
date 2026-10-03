// 고를 수 있는 AI 모델 (DESIGN.md 13절). 서버는 이 목록에 있는 모델만 부른다 —
// 브라우저가 보낸 이름을 그대로 쓰면 공개 링크로 비싼 모델을 마음대로 부를 수 있다.
export const AI_MODELS = [
  { id: "gpt-5.4-nano", label: "빠르게", hint: "가장 빠르고 저렴해요. 단순한 값 채우기에 맞아요." },
  { id: "gpt-5.4-mini", label: "기본", hint: "속도와 정확도의 균형이에요." },
  { id: "gpt-5.4", label: "꼼꼼하게", hint: "복잡한 계산·정리에 맞아요. 느리고 비용이 더 들어요." },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export const DEFAULT_AI_MODEL: AiModelId = "gpt-5.4-mini";

// 목록에 없는 값(빈 값, 오타, 임의 모델명)은 기본 모델로 바꾼다
export function resolveModel(id: unknown): AiModelId {
  return AI_MODELS.find((m) => m.id === id)?.id ?? DEFAULT_AI_MODEL;
}

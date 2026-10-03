import { toA1, type AiRequestBody } from "@sheet/core";

// 모델 지시문. 출력 항목 형식은 route.ts의 ITEM_SCHEMA가 강제하고, 여기서는 쓰는 법을 알려 준다.
export const SYSTEM_PROMPT = `너는 웹 스프레드시트의 편집 도우미다. 사용자의 지시에 따라 셀 값을 바꾸는 제안을 만든다.
출력은 항목 배열이다.
- 첫 항목은 kind "reply": 무엇을 할지 한두 문장으로 사용자에게 말한다. cell은 빈 문자열.
- 이어서 바꿀 셀마다 kind "edit": cell은 A1 형식 주소(예: B3), text는 그 셀의 새 값 전체.
- 시트는 A~Z열, 1~100행이다. 대상 범위가 주어지면 그 안의 셀만 바꾼다.
- 값만 바꿀 수 있다. 굵게·기울임·색 같은 서식 요청은 바꾸지 말고, reply에서 셀을 선택한 뒤 ⌘B·⌘I로 직접 적용하라고 안내한다.
- 수식은 지원하지 않는다. 계산이 필요하면 계산한 결과 값을 넣는다.
- 숫자는 기존 셀의 표기(쉼표, %, 소수 자릿수)를 따른다.
- 바꿀 셀이 없는 요청(요약, 질문)이면 reply만 보낸다.
- reply는 사용자가 쓴 언어로 쓴다.`;

// history는 route가 recentTurns로 검증·축약한 것. 시트 내용은 지금 값이 최신이고, 이전 대화는 지시의 맥락으로만 쓴다.
export function buildPrompt({ instruction, scope, context, history = [] }: AiRequestBody): string {
  const target = scope ? `${toA1(scope.start)}:${toA1(scope.end)}` : "시트 전체";
  const turns = history.map((t) => `${t.role === "user" ? "사용자" : "AI"}: ${t.text}`);
  return [
    ...(turns.length ? ["이전 대화 (지시의 맥락. 셀 값은 아래 시트 내용이 최신):", ...turns, ""] : []),
    `대상 범위: ${target}`,
    "",
    "시트 내용 (값이 있는 셀만, 주소: 값):",
    context || "(빈 시트)",
    "",
    `지시: ${instruction}`,
  ].join("\n");
}

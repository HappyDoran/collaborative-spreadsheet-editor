import { DEFAULT_AI_MODEL, type AiErrorCode, type AiModelId, type AiScope, type ProposedEdit } from "@sheet/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// AI 편집의 로컬 상태 (DESIGN.md 13절 D안). 적용 전 제안은 내 탭의 초안이라 sessionStorage에 둔다 —
// 새로고침해도 남고 탭을 닫으면 사라진다. 시트 값은 들고 있지 않다: 제안의 원래 값·새 값만.

// reading: 요청을 보내고 첫 응답을 기다림 / streaming: 셀이 채워지는 중 / review: 적용·버리기 대기
export type AiStatus = "idle" | "reading" | "streaming" | "review";

export type AiMessage =
  | { id: number; role: "user" | "ai" | "notice"; text: string }
  | { id: number; role: "error"; code: AiErrorCode };

type AiState = {
  open: boolean;
  scopeMode: "auto" | "selection" | "sheet"; // auto: 여러 칸이면 선택 범위, 한 칸이면 시트 전체
  mock: boolean; // 가짜 응답 모드 (디버깅 버튼) — 저장하지 않는다
  model: AiModelId;
  status: AiStatus;
  scope: AiScope; // 보낸 순간 고정된 대상
  edits: ProposedEdit[]; // 검토 중인 제안 — 한 번에 적용하거나 버린다
  excluded: number; // 대상 밖·잘못된 주소로 버린 제안 수
  messages: AiMessage[];
  lastInstruction: string;
  lastScope: AiScope; // 다시 시도할 때 쓰는 마지막 요청의 대상
};

const IDLE_RUN: Pick<AiState, "status" | "scope" | "edits" | "excluded"> = {
  status: "idle",
  scope: null,
  edits: [],
  excluded: 0,
};

export const useAiStore = create<AiState>()(
  persist(
    (): AiState => ({
      open: false,
      scopeMode: "auto",
      mock: false,
      model: DEFAULT_AI_MODEL,
      ...IDLE_RUN,
      messages: [],
      lastInstruction: "",
      lastScope: null,
    }),
    {
      name: "sheet:ai",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true, // hooks/useAiEdit가 마운트 후 읽는다
      // 가짜 응답 모드는 저장값이 아니라 디버깅 버튼·환경이 정한다(mock: current.mock).
      // 생성 중에 새로고침하면 스트림을 이어 받을 수 없다 — 받은 제안을 버린다
      merge: (persisted, current): AiState => {
        const saved = { ...(persisted as Partial<AiState>), mock: current.mock };
        if (saved.status !== "reading" && saved.status !== "streaming") return { ...current, ...saved };
        const messages = saved.messages ?? [];
        const notice: AiMessage = { id: nextId(messages), role: "notice", text: "새로고침으로 생성이 멈췄어요." };
        return { ...current, ...saved, ...IDLE_RUN, messages: [...messages, notice] };
      },
    },
  ),
);

export function pushMessage(message: { role: "user" | "ai" | "notice"; text: string } | { role: "error"; code: AiErrorCode }) {
  useAiStore.setState((s) => ({ messages: [...s.messages, { ...message, id: nextId(s.messages) } as AiMessage] }));
}

// 생성 중 AI 설명이 이어서 오면 마지막 AI 말풍선에 붙인다
export function appendAiText(text: string) {
  useAiStore.setState((s) => {
    const last = s.messages.at(-1);
    if (last?.role === "ai") return { messages: [...s.messages.slice(0, -1), { ...last, text: `${last.text}\n${text}` }] };
    return { messages: [...s.messages, { id: nextId(s.messages), role: "ai", text }] };
  });
}

export const endRun = () => useAiStore.setState(IDLE_RUN);

// 새로고침 뒤에도 메시지 id가 겹치지 않게 저장된 목록에서 이어 센다
const nextId = (messages: AiMessage[]) => (messages.at(-1)?.id ?? 0) + 1;

import type { AiErrorCode, AiScope, ProposedEdit } from "@sheet/core";
import { create } from "zustand";

// AI 편집의 로컬 상태 (탭마다, 저장하지 않음 — DESIGN.md 13절). 시트 값은 들고 있지 않다: 제안의 원래 값·새 값만.

// reading: 요청을 보내고 첫 응답을 기다림 / streaming: 셀이 채워지는 중 / review: 적용·버리기 대기
export type AiStatus = "idle" | "reading" | "streaming" | "review";

export type AiMessage =
  | { id: number; role: "user" | "ai" | "notice"; text: string }
  | { id: number; role: "error"; code: AiErrorCode };

type AiState = {
  open: boolean;
  scopeMode: "auto" | "selection" | "sheet"; // auto: 여러 칸이면 선택 범위, 한 칸이면 시트 전체
  mock: boolean; // 가짜 응답 모드 (디버깅 버튼)
  status: AiStatus;
  scope: AiScope; // 보낸 순간 고정된 대상
  edits: ProposedEdit[];
  excluded: number; // 대상 밖·잘못된 주소로 버린 제안 수
  messages: AiMessage[];
  lastInstruction: string;
};

let nextId = 1;

export const useAiStore = create<AiState>()(() => ({
  open: false,
  scopeMode: "auto",
  mock: false,
  status: "idle",
  scope: null,
  edits: [],
  excluded: 0,
  messages: [],
  lastInstruction: "",
}));

export function pushMessage(message: Omit<Extract<AiMessage, { role: "user" | "ai" | "notice" }>, "id"> | Omit<Extract<AiMessage, { role: "error" }>, "id">) {
  useAiStore.setState((s) => ({ messages: [...s.messages, { ...message, id: nextId++ } as AiMessage] }));
}

// 생성 중 AI 설명이 이어서 오면 마지막 AI 말풍선에 붙인다
export function appendAiText(text: string) {
  useAiStore.setState((s) => {
    const last = s.messages.at(-1);
    if (last?.role === "ai") return { messages: [...s.messages.slice(0, -1), { ...last, text: `${last.text}\n${text}` }] };
    return { messages: [...s.messages, { id: nextId++, role: "ai", text }] };
  });
}

export const endRun = () => useAiStore.setState({ status: "idle", scope: null, edits: [], excluded: 0 });

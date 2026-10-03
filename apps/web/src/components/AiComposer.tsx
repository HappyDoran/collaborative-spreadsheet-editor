"use client";

import { AI_MODELS, scopesOverlap, toA1, type AiModelId, type AiScope } from "@sheet/core";
import type { RefObject } from "react";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { resolveScope, type AiCommands } from "@/hooks/useAiEdit";
import type { Participant } from "@/hooks/usePresence";
import { useAiStore } from "@/stores/aiStore";
import { useSelectionStore } from "@/stores/selectionStore";

const scopeLabel = (scope: AiScope) => (scope ? `${toA1(scope.start)}:${toA1(scope.end)}` : "시트 전체");

type Props = {
  ai: AiCommands;
  others: Participant[]; // 다른 참여자 — 겹치는 AI 작업 경고(X3)
  draft: string;
  onDraftChange: (draft: string) => void;
  gridInputRef: RefObject<HTMLInputElement | null>;
};

// AI 패널 아래쪽: 겹침 경고, 대상(선택 범위 / 시트 전체), 지시 입력, 모델, 보내기.
export function AiComposer({ ai, others, draft, onDraftChange: setDraft, gridInputRef }: Props) {
  const { status, scope, scopeMode, model } = useAiStore(
    useShallow((s) => ({ status: s.status, scope: s.scope, scopeMode: s.scopeMode, model: s.model })),
  );
  useSelectionStore(useShallow((s) => [s.active, s.extent])); // 대기 중 대상 표시가 선택을 따라가게
  const target = status === "idle" ? resolveScope(scopeMode) : scope;
  const autoIsSheet = scopeMode === "auto" && target === null;
  // X3: 보내기 전, 내 대상이 다른 사람의 AI 생성·검토 범위와 겹치면 알린다 — 막지는 않는다 (DESIGN.md 15절)
  const overlapping = status === "idle" ? others.filter((p) => p.ai && scopesOverlap(target, p.ai.area)) : [];
  const first = overlapping[0];

  const send = () => {
    if (status !== "idle") return; // 빈 지시는 ai.send가 거른다
    void ai.send(draft);
    setDraft("");
  };

  return (
    <Composer
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      {first?.ai && (
        <Overlap role="status">
          {first.user.name}님이 {first.ai.area ? `${scopeLabel(first.ai.area)} 범위` : "시트 전체"}를 AI로{" "}
          {first.ai.state === "generating" ? "생성하는" : "검토하는"} 중이에요
          {overlapping.length > 1 ? ` (외 ${overlapping.length - 1}명)` : ""}. 겹치는 칸은 먼저 적용한 쪽이 반영돼요.
        </Overlap>
      )}
      <ScopeRow>
        <span>
          대상: <strong>{scopeLabel(target)}</strong>
        </span>
        <Segmented role="group" aria-label="AI 대상">
          {(["selection", "sheet"] as const).map((mode) => (
            <Segment
              key={mode}
              type="button"
              disabled={status !== "idle"}
              aria-pressed={scopeMode === mode || (scopeMode === "auto" && (mode === "sheet") === autoIsSheet)}
              onClick={() => useAiStore.setState({ scopeMode: mode })}
            >
              {mode === "selection" ? "선택 범위만" : "시트 전체"}
            </Segment>
          ))}
        </Segmented>
      </ScopeRow>
      <Input
        id="ai-input"
        aria-label="AI에게 할 일"
        rows={3}
        placeholder="예: 금액 열에 부가세 10% 더하기"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter는 IME 몫
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          } else if (e.key === "Escape") {
            e.preventDefault();
            gridInputRef.current?.focus();
          }
        }}
      />
      <ComposerFoot>
        <ModelSelect
          aria-label="AI 모델"
          title={AI_MODELS.find((m) => m.id === model)?.hint}
          value={model}
          disabled={status !== "idle"}
          onChange={(e) => useAiStore.setState({ model: e.target.value as AiModelId })}
        >
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.id})
            </option>
          ))}
        </ModelSelect>
        <Button type="submit" $primary disabled={!draft.trim() || status !== "idle"}>
          보내기
        </Button>
      </ComposerFoot>
      <Hint>Enter로 보내고 Shift+Enter로 줄을 바꿔요</Hint>
    </Composer>
  );
}

export const Button = styled.button<{ $primary?: boolean }>`
  height: 30px;
  padding: 0 12px;
  border: 1px solid ${(p) => (p.$primary ? "var(--primary)" : "var(--rule)")};
  border-radius: 4px;
  background: ${(p) => (p.$primary ? "var(--primary)" : "#fff")};
  color: ${(p) => (p.$primary ? "#fff" : "var(--ink)")};
  font: inherit;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${(p) => (p.$primary ? "var(--primary-hover)" : "var(--header)")};
    border-color: ${(p) => (p.$primary ? "var(--primary-hover)" : "var(--rule)")};
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
`;

const Composer = styled.form`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid var(--rule);
`;

const Overlap = styled.p`
  margin: 0;
  padding: 6px 8px;
  border-left: 3px solid var(--marker-edge);
  background: color-mix(in srgb, var(--marker) 50%, var(--paper));
  color: var(--ink);
  font-size: 12px;
  line-height: 1.5;
`;

const ScopeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--ink-muted);
  font-size: 12px;

  strong {
    color: var(--ink);
  }
`;

const Segmented = styled.div`
  display: flex;
  border: 1px solid var(--rule);
  border-radius: 4px;
  overflow: hidden;
`;

const Segment = styled.button`
  padding: 3px 8px;
  border: 0;
  background: #fff;
  color: var(--ink-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  & + & {
    border-left: 1px solid var(--rule);
  }
  &[aria-pressed="true"] {
    background: var(--primary-weak);
    color: var(--primary);
  }
  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;

const Input = styled.textarea`
  resize: none;
  padding: 8px 10px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  line-height: 1.5;

  &:focus {
    outline: 2px solid var(--primary);
    outline-offset: -1px;
  }
`;

const ComposerFoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModelSelect = styled.select`
  max-width: 200px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-size: 12px;

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 1px;
  }
  &:disabled {
    opacity: 0.6;
  }
`;

const Hint = styled.span`
  color: var(--ink-muted);
  font-size: 11px;
`;

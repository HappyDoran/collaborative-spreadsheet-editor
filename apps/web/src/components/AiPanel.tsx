"use client";

import { AI_MODELS, cellKey, scopesOverlap, toA1, type AiErrorCode, type AiModelId, type AiScope } from "@sheet/core";
import { useEffect, useRef, useState, type RefObject } from "react";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { resolveScope, type AiCommands } from "@/hooks/useAiEdit";
import type { Participant } from "@/hooks/usePresence";
import { useAiStore, type AiMessage } from "@/stores/aiStore";
import { useSelectionStore } from "@/stores/selectionStore";

// 원인마다 사람이 할 일이 다르다 — 다시 시도로 풀리는지 함께 정한다 (DESIGN.md 13절)
const ERRORS: Record<AiErrorCode, { text: string; retry: boolean }> = {
  network: { text: "연결이 끊겼어요. 다시 시도해 주세요.", retry: true },
  timeout: { text: "AI 응답이 없어요. 다시 시도해 주세요.", retry: true },
  invalid: { text: "AI 결과를 읽지 못했어요. 요청을 바꿔 다시 시도해 주세요.", retry: true },
  rate: { text: "요청이 몰려 있어요. 잠시 뒤 다시 시도해 주세요.", retry: true },
  upstream: { text: "AI 서비스에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.", retry: true },
  too_large: { text: "요청이 너무 커요. 지시를 줄이거나 대상 범위를 좁혀 주세요.", retry: false },
  quota: { text: "지금은 AI를 쓸 수 없어요(사용 한도 도달). 시트 편집은 계속할 수 있어요.", retry: false },
  config: { text: "AI 연결 설정에 문제가 있어요. 시트 편집은 계속할 수 있어요.", retry: false },
};

const scopeLabel = (scope: AiScope) => (scope ? `${toA1(scope.start)}:${toA1(scope.end)}` : "시트 전체");

type Props = {
  open: boolean;
  ai: AiCommands;
  staleCount: number;
  others: Participant[]; // 다른 참여자 — 겹치는 AI 작업 경고(X3)
  gridInputRef: RefObject<HTMLInputElement | null>;
};

// 닫혀 있어도 마운트를 유지한다 — 닫는 애니메이션을 보이고, 입력 중이던 지시도 남긴다.
// 닫힌 동안은 inert라 키보드·스크린리더가 들어가지 않는다.
export function AiPanel({ open, ai, staleCount, others, gridInputRef }: Props) {
  const { status, scope, edits, messages, mock, scopeMode, model } = useAiStore(
    useShallow((s) => ({
      status: s.status,
      scope: s.scope,
      edits: s.edits,
      messages: s.messages,
      mock: s.mock,
      scopeMode: s.scopeMode,
      model: s.model,
    })),
  );
  useSelectionStore(useShallow((s) => [s.active, s.extent])); // 대기 중 대상 표시가 선택을 따라가게
  const [draft, setDraft] = useState("");
  const running = status === "reading" || status === "streaming";
  const target = status === "idle" ? resolveScope(scopeMode) : scope;
  const autoIsSheet = scopeMode === "auto" && target === null;
  // X3: 보내기 전, 내 대상이 다른 사람의 AI 생성·검토 범위와 겹치면 알린다 — 막지는 않는다 (DESIGN.md 15절)
  const overlapping = status === "idle" ? others.filter((p) => p.ai && scopesOverlap(target, p.ai.area)) : [];
  const allStale = staleCount > 0 && staleCount === edits.length;

  // 새 메시지가 오면 맨 아래로
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // 첫 제안이 도착하면 그 셀로 스크롤 — 시트 전체가 대상이면 화면 밖에 생길 수 있다
  const firstEdit = edits[0] ? cellKey(edits[0].addr) : null;
  useEffect(() => {
    if (firstEdit) document.querySelector(`[data-proposal="${firstEdit}"]`)?.scrollIntoView({ block: "center", inline: "center" });
  }, [firstEdit]);

  // 시트 전체가 대상이면 제안이 화면 밖에 있을 수 있다 — 누를 때마다 다음 제안 칸으로 스크롤만 한다(선택은 그대로)
  const cursor = useRef(0);
  const showNext = () => {
    const boxes = document.querySelectorAll("[data-proposal]");
    boxes[cursor.current++ % Math.max(boxes.length, 1)]?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  };

  const send = () => {
    if (status !== "idle") return; // 빈 지시는 ai.send가 거른다
    void ai.send(draft);
    setDraft("");
  };

  const lastError = messages.at(-1)?.role === "error" ? messages.at(-1) : null;
  // 적용·버리기 뒤에는 시트로 돌아간다 — 바로 ⌘Z로 되돌리거나 이어서 편집할 수 있게
  const backToGrid = () => gridInputRef.current?.focus();

  return (
    <Slot $open={open} inert={!open}>
      <Panel aria-label="AI 편집">
        <Header>
          <Title>AI 편집</Title>
          <Close type="button" aria-label="AI 편집 닫기" onClick={() => useAiStore.setState({ open: false })}>
            ✕
          </Close>
        </Header>
        {mock && <MockBand>가짜 응답 모드예요. 실제 AI를 부르지 않아요.</MockBand>}

        <Messages ref={listRef} aria-live="polite">
          {messages.length === 0 && (
            <Empty>
              범위를 선택하고 할 일을 적어 보세요. AI가 셀 값을 제안하면 시트에서 원래 값과 비교한 뒤 적용할 수 있어요.
            </Empty>
          )}
          {messages.map((m) => (
            <Message key={m.id} $role={m.role}>
              {m.role === "error" ? ERRORS[m.code].text : m.text}
              {m === lastError && status === "idle" && m.role === "error" && ERRORS[m.code].retry && (
                <InlineButton type="button" onClick={ai.retry}>
                  다시 시도
                </InlineButton>
              )}
            </Message>
          ))}
        </Messages>

        {running && (
          <Status role="status">
            <span>{status === "reading" ? "시트를 읽는 중…" : `셀을 채우는 중… ${edits.length}개`}</span>
            <Button type="button" onClick={ai.stop}>
              중지
            </Button>
          </Status>
        )}

        {status === "review" && (
          <Review>
            <Preview>미리보기예요. 아직 시트에 적용되지 않았어요.</Preview>
            <Summary>
              <span>제안 {edits.length}개</span>
              <InlineButton type="button" onClick={showNext} title="누를 때마다 다음 제안 칸으로 스크롤해요">
                위치 보기
              </InlineButton>
            </Summary>
            {staleCount > 0 && (
              <Warn>
                {allStale
                  ? "모든 칸의 원래 값이 바뀌었어요. 지금 값으로 다시 요청해 주세요."
                  : `${staleCount}개 셀의 원래 값이 요청 뒤에 바뀌었어요. 적용할 때 그 칸은 건너뛰어요.`}
              </Warn>
            )}
            <Actions>
              <Button type="button" $primary disabled={allStale} onClick={() => (ai.apply(), backToGrid())}>
                {staleCount > 0 && !allStale ? `바뀐 ${staleCount}칸 빼고 적용` : "적용"}
              </Button>
              <Button type="button" onClick={() => (ai.discard(), backToGrid())}>
                버리기
              </Button>
            </Actions>
          </Review>
        )}

        <Composer
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {overlapping[0] && (
            <Overlap role="status">
              {overlapping[0].user.name}님이{" "}
              {overlapping[0].ai!.area ? `${scopeLabel(overlapping[0].ai!.area)} 범위` : "시트 전체"}를 AI로{" "}
              {overlapping[0].ai!.state === "generating" ? "만드는" : "검토하는"} 중이에요
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
      </Panel>
    </Slot>
  );
}

const PANEL_W = 340;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

// 넓은 화면: 슬롯 너비가 0 ↔ 340으로 바뀌며 시트가 비켜서고, 패널은 오른쪽에 붙어 미끄러져 들어온다.
// 좁은 화면: 시트 위로 덮이며 오른쪽에서 밀려 들어온다. 닫힌 뒤에는 visibility로 숨겨 접근 트리에서도 뺀다.
const Slot = styled.div<{ $open: boolean }>`
  display: flex;
  justify-content: flex-end;
  flex: none;
  width: ${(p) => (p.$open ? PANEL_W : 0)}px;
  min-height: 0;
  overflow: hidden;
  visibility: ${(p) => (p.$open ? "visible" : "hidden")};
  transition:
    width 220ms ${EASE},
    visibility 0s linear ${(p) => (p.$open ? "0s" : "220ms")};

  @media (max-width: 900px) {
    position: absolute;
    inset: 0 0 0 auto;
    z-index: 5;
    width: min(${PANEL_W}px, 100%);
    transform: translateX(${(p) => (p.$open ? "0" : "100%")});
    box-shadow: ${(p) => (p.$open ? "-8px 0 24px rgb(30 35 40 / 0.14)" : "none")};
    transition:
      transform 220ms ${EASE},
      visibility 0s linear ${(p) => (p.$open ? "0s" : "220ms")};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Panel = styled.aside`
  display: flex;
  flex-direction: column;
  width: ${PANEL_W}px;
  max-width: 100%;
  flex: none;
  min-height: 0;
  border-left: 1px solid var(--rule);
  background: var(--paper);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 8px 0 14px;
  border-bottom: 1px solid var(--rule);
`;

const Title = styled.h2`
  margin: 0;
  font-size: 13px;
  font-weight: 650;
`;

const Close = styled.button`
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;

  &:hover {
    background: var(--header);
  }
`;

const MockBand = styled.p`
  margin: 0;
  padding: 6px 14px;
  background: var(--marker);
  color: var(--ink);
  font-size: 12px;
`;

const Messages = styled.ol`
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 12px 14px;
  overflow-y: auto;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Empty = styled.li`
  color: var(--ink-muted);
  line-height: 1.6;
`;

const Message = styled.li<{ $role: AiMessage["role"] }>`
  max-width: 92%;
  padding: ${(p) => (p.$role === "notice" ? "0" : "7px 10px")};
  border-radius: 8px;
  line-height: 1.5;
  white-space: pre-wrap;
  align-self: ${(p) => (p.$role === "user" ? "flex-end" : "flex-start")};
  background: ${(p) => (p.$role === "user" ? "var(--header)" : p.$role === "ai" ? "#fff" : "transparent")};
  border: ${(p) => (p.$role === "ai" ? "1px solid var(--rule)" : "0")};
  color: ${(p) => (p.$role === "notice" ? "var(--ink-muted)" : p.$role === "error" ? "var(--danger)" : "var(--ink)")};
  font-size: ${(p) => (p.$role === "notice" ? "12px" : "13px")};
`;

const Status = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-top: 1px solid var(--rule);
  color: var(--ink-muted);
`;

const Review = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 14px;
  border-top: 1px solid var(--rule);
  background: color-mix(in srgb, var(--marker) 45%, var(--paper));
`;

const Preview = styled.p`
  margin: 0;
  font-weight: 600;
`;

const Warn = styled.p`
  margin: 0;
  color: var(--danger);
  font-size: 12px;
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 2px;
`;

const Button = styled.button<{ $primary?: boolean }>`
  height: 30px;
  padding: 0 12px;
  border: 1px solid ${(p) => (p.$primary ? "var(--ink)" : "var(--rule)")};
  border-radius: 4px;
  background: ${(p) => (p.$primary ? "var(--ink)" : "#fff")};
  color: ${(p) => (p.$primary ? "#fff" : "var(--ink)")};
  font: inherit;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

const InlineButton = styled.button`
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
`;

const Summary = styled.div`
  display: flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
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
    background: var(--ink);
    color: #fff;
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
    outline: 2px solid var(--accent);
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
    outline: 2px solid var(--accent);
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

"use client";

import { cellKey, type AiErrorCode } from "@sheet/core";
import { useEffect, useRef, useState, type RefObject } from "react";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import type { AiCommands } from "@/hooks/useAiEdit";
import type { Participant } from "@/hooks/usePresence";
import { useAiStore, type AiMessage } from "@/stores/aiStore";
import { AiComposer, Button } from "./AiComposer";

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
  const { status, edits, messages, mock } = useAiStore(
    useShallow((s) => ({ status: s.status, edits: s.edits, messages: s.messages, mock: s.mock })),
  );
  const [draft, setDraft] = useState(""); // 입력 중인 지시 — 빈 패널의 예시 버튼도 채운다
  const running = status === "reading" || status === "streaming";
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
              <Examples>
                {/* 빈 시트에서도 바로 써 볼 수 있게 — 누르면 입력칸에 채우기만 하고, 보내기는 사용자가 한다 */}
                {EXAMPLES.map((text) => (
                  <Example
                    key={text}
                    type="button"
                    onClick={() => {
                      setDraft(text);
                      document.getElementById("ai-input")?.focus();
                    }}
                  >
                    {text}
                  </Example>
                ))}
              </Examples>
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

        <AiComposer
          ai={ai}
          others={others}
          draft={draft}
          onDraftChange={setDraft}
          gridInputRef={gridInputRef}
        />
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

const EXAMPLES = [
  "A1부터 지점 5곳의 1~3월 매출 예시 표를 만들어 줘",
  "선택한 칸의 숫자에 10%를 더해 줘",
  "선택한 칸을 영어로 번역해 줘",
];

const Empty = styled.li`
  color: var(--ink-muted);
  line-height: 1.6;
`;

const Examples = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 10px;
`;

const Example = styled.button`
  padding: 4px 10px;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: var(--primary);
    background: var(--primary-weak);
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
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

const InlineButton = styled.button`
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
`;

const Summary = styled.div`
  display: flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
`;

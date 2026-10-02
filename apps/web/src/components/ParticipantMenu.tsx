"use client";

import { NAME_MAX_LENGTH, initialOf, normalizeName, toA1 } from "@sheet/core";
import { useState } from "react";
import styled from "styled-components";
import type { Participant } from "@/hooks/usePresence";

const STACK_LIMIT = 4;

type Props = {
  participants: Participant[]; // 나를 맨 앞에 둔 목록
  onRename: (name: string) => void;
  onClearName: () => void;
};

// 헤더 오른쪽: 다른 참여자 아바타 + 내 아바타. 내 아바타를 누르면 접속자 목록과 이름 바꾸기·지우기.
export function ParticipantMenu({ participants, onRename, onClearName }: Props) {
  const me = participants.find((p) => p.isSelf);
  const others = participants.filter((p) => !p.isSelf);
  const [draft, setDraft] = useState<string | null>(null); // null이면 보기 상태

  if (!me) return null;
  const hidden = others.length - STACK_LIMIT;

  return (
    <Wrapper>
      <Stack aria-hidden>
        {others.slice(0, STACK_LIMIT).map((p) => (
          <Avatar key={p.clientId} title={p.user.name} style={{ background: p.user.color }}>
            {initialOf(p.user.name)}
          </Avatar>
        ))}
        {hidden > 0 && <Avatar $more>+{hidden}</Avatar>}
      </Stack>
      <MeButton
        type="button"
        popoverTarget="participant-panel"
        aria-label={`${me.user.name}(나) — 접속 중 ${participants.length}명, 이름 설정`}
        title={`${me.user.name}(나)`}
        style={{ background: me.user.color }}
      >
        {initialOf(me.user.name)}
      </MeButton>

      <Panel id="participant-panel" popover="auto" onToggle={() => setDraft(null)}>
        <PanelTitle>접속 중 {participants.length}명</PanelTitle>
        <List>
          {participants.map((p) => (
            <Row key={p.clientId}>
              <Avatar style={{ background: p.user.color }} $small>
                {initialOf(p.user.name)}
              </Avatar>
              <Name>
                {p.user.name}
                {p.isSelf && <Muted> (나)</Muted>}
              </Name>
              {p.cursor && (
                <Muted>
                  {toA1(p.cursor.active)} {p.cursor.editing ? "입력 중" : ""}
                </Muted>
              )}
            </Row>
          ))}
        </List>

        {draft === null ? (
          <Actions>
            <TextButton type="button" onClick={() => setDraft(me.user.name)}>
              이름 바꾸기
            </TextButton>
            <TextButton type="button" $danger onClick={onClearName}>
              이름 지우기
            </TextButton>
          </Actions>
        ) : (
          <RenameForm
            onSubmit={(e) => {
              e.preventDefault();
              const name = normalizeName(draft);
              if (!name) return;
              onRename(name);
              setDraft(null);
            }}
          >
            <RenameInput
              autoFocus
              aria-label="새 이름"
              maxLength={NAME_MAX_LENGTH}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation(); // 패널은 열어 둔 채 편집만 취소
                  setDraft(null);
                }
              }}
            />
            <TextButton type="submit" disabled={!normalizeName(draft)}>
              저장
            </TextButton>
          </RenameForm>
        )}
      </Panel>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
`;

const Stack = styled.div`
  display: flex;

  & > * + * {
    margin-left: -6px;
  }
`;

const Avatar = styled.span<{ $small?: boolean; $more?: boolean }>`
  display: grid;
  place-items: center;
  flex: none;
  width: ${(p) => (p.$small ? 22 : 28)}px;
  height: ${(p) => (p.$small ? 22 : 28)}px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--paper);
  background: ${(p) => (p.$more ? "var(--header)" : "transparent")};
  color: ${(p) => (p.$more ? "var(--ink-muted)" : "#fff")};
  font-size: ${(p) => (p.$small ? 11 : 12)}px;
  font-weight: 650;
`;

const MeButton = styled.button`
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--paper), 0 0 0 3.5px var(--accent);
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 4px;
  }
`;

const Panel = styled.div`
  position: fixed;
  inset: 50px 12px auto auto;
  width: 260px;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 8px 24px rgb(30 35 40 / 0.14);
`;

const PanelTitle = styled.p`
  margin: 0 0 8px;
  color: var(--ink-muted);
  font-size: 12px;
`;

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
`;

const Name = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Muted = styled.span`
  color: var(--ink-muted);
  font-size: 12px;
`;

const Actions = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--rule);
`;

const TextButton = styled.button<{ $danger?: boolean }>`
  padding: 4px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${(p) => (p.$danger ? "#b42318" : "var(--ink)")};
  font: inherit;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--header);
  }
  &:disabled {
    color: var(--ink-faint);
    cursor: default;
  }
`;

const RenameForm = styled.form`
  display: flex;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--rule);
`;

const RenameInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  font: inherit;

  &:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
`;

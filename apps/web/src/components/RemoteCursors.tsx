"use client";

import { isSingleCell, normalizeRange } from "@sheet/core";
import styled, { keyframes } from "styled-components";
import type { Participant } from "@/hooks/usePresence";
import { rectOf, single } from "./gridGeometry";

// 다른 참여자의 선택 범위·셀 포인터·편집 중 셀 (C5). 내 포인터와 같은 문법(테두리)을 각자 색으로 쓴다.
// AI 생성·검토 중인 범위는 그 사람 색 점선과 이름표로만 보인다 — 제안 값은 보이지 않는다 (DESIGN.md 13절 D안).
export function RemoteCursors({ others }: { others: Participant[] }) {
  return others.map(({ clientId, cursor, user, ai }) => {
    if (!cursor) return null;
    const style = { "--who": user.color } as React.CSSProperties;

    // AI 작업 중에는 그 사람의 표시를 AI 범위 하나로 합친다 — 선택·포인터·이름표가 겹쳐 값을 가리지 않게
    if (ai?.area) {
      const area = rectOf(ai.area);
      return (
        <Layer key={clientId} style={style}>
          <AiArea style={area} />
          <AiTag style={{ top: area.top, left: area.left }} $below={ai.area.start.row === 0}>
            {user.name} · {ai.state === "generating" ? "AI 생성 중" : "AI 검토 중"}
          </AiTag>
        </Layer>
      );
    }

    const range = normalizeRange(cursor.active, cursor.extent);
    const cell = rectOf(single(cursor.active));
    return (
      <Layer key={clientId} style={style}>
        {!isSingleCell(range) && <Range style={rectOf(range)} />}
        <Pointer style={cell} $editing={cursor.editing} />
        {/* 이름표는 움직인 직후에만 보이고 접힌다 — 옆 칸 값을 계속 가리지 않게. 입력 중에는 남긴다.
            key로 위치·상태가 바뀔 때마다 다시 그려 사라지는 시간을 새로 센다. */}
        <Tag
          key={`${cursor.active.row}:${cursor.active.col}:${cursor.editing}`}
          style={{ top: cell.top, left: cell.left + cell.width }}
          $below={cursor.active.row === 0}
          $fade={!cursor.editing}
        >
          {cursor.editing ? `${user.name} · 입력 중` : user.name}
        </Tag>
      </Layer>
    );
  });
}

const Layer = styled.div`
  display: contents;
`;

const Range = styled.div`
  position: absolute;
  z-index: 1;
  pointer-events: none;
  background: color-mix(in srgb, var(--who) 7%, transparent);
  outline: 1px solid var(--who);
  outline-offset: -1px;
`;

const Pointer = styled.div<{ $editing: boolean }>`
  position: absolute;
  z-index: 1;
  pointer-events: none;
  border: 2px ${(p) => (p.$editing ? "dashed" : "solid")} var(--who);
  background: ${(p) => (p.$editing ? "color-mix(in srgb, var(--who) 12%, transparent)" : "transparent")};
`;

const AiArea = styled.div`
  position: absolute;
  z-index: 1;
  pointer-events: none;
  outline: 2px dashed var(--who);
  outline-offset: -2px;
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--who) 8%, transparent) 0 6px,
    transparent 6px 12px
  );
`;

// 범위 왼쪽 위에 붙는 AI 상태 이름표. 첫 행이면 머리글에 가리지 않게 범위 안쪽 위에 둔다.
const AiTag = styled.div<{ $below: boolean }>`
  position: absolute;
  z-index: 2;
  pointer-events: none;
  transform: ${(p) => (p.$below ? "none" : "translateY(-100%)")};
  padding: 1px 6px;
  border: 1px dashed var(--who);
  border-radius: 3px 3px 0 0;
  background: var(--paper);
  color: var(--who);
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  white-space: nowrap;
`;

const fadeOut = keyframes`
  to {
    opacity: 0;
    visibility: hidden;
  }
`;

// 셀 오른쪽 위 모서리에 붙는 이름표. 첫 행이면 머리글에 가리지 않게 아래로 내린다. 긴 이름은 말줄임.
const Tag = styled.div<{ $below: boolean; $fade: boolean }>`
  position: absolute;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: ${(p) => (p.$fade ? fadeOut : "none")} 0.3s ease 3s forwards;
  z-index: 2;
  pointer-events: none;
  transform: ${(p) => (p.$below ? "translate(-100%, 24px)" : "translate(-100%, -100%)")};
  padding: 1px 6px;
  border-radius: 3px 3px 0 0;
  background: var(--who);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
`;

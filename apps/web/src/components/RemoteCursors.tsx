"use client";

import { normalizeRange } from "@sheet/core";
import styled from "styled-components";
import type { Participant } from "@/hooks/usePresence";
import { rectOf, single } from "./gridGeometry";

// 다른 참여자의 선택 범위·셀 포인터·편집 중 셀 (C5). 내 포인터와 같은 문법(테두리)을 각자 색으로 쓴다.
export function RemoteCursors({ others }: { others: Participant[] }) {
  return others.map(({ clientId, cursor, user }) => {
    if (!cursor) return null;
    const range = normalizeRange(cursor.active, cursor.extent);
    const multi = range.start.row !== range.end.row || range.start.col !== range.end.col;
    const cell = rectOf(single(cursor.active));
    return (
      <Layer key={clientId} style={{ "--who": user.color } as React.CSSProperties}>
        {multi && <Range style={rectOf(range)} />}
        <Pointer style={cell} $editing={cursor.editing} />
        <Tag style={{ top: cell.top, left: cell.left + cell.width }} $below={cursor.active.row === 0}>
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

// 셀 오른쪽 위 모서리에 붙는 이름표. 첫 행이면 머리글에 가리지 않게 아래로 내린다.
const Tag = styled.div<{ $below: boolean }>`
  position: absolute;
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

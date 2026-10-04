"use client";

import { isSingleCell, normalizeRange } from "@sheet/core";
import styled from "styled-components";
import type { Participant } from "@/hooks/usePresence";
import { areaOf, single } from "./gridGeometry";

// 다른 참여자의 선택 범위·셀 포인터·편집 중 셀 (C5). 내 포인터와 같은 문법(테두리)을 각자 색으로 쓴다.
// AI 생성·검토 중인 범위는 그 사람 색 점선과 이름표로만 보인다 — 제안 값은 보이지 않는다 (DESIGN.md 13절 D안).
export function RemoteCursors({ others }: { others: Participant[] }) {
  return others.map(({ clientId, cursor, user, ai }) => {
    if (!cursor) return null;
    const style = { "--who": user.color } as React.CSSProperties;

    // AI 작업 중에는 그 사람의 표시를 AI 범위 하나로 합친다 — 선택·포인터·이름표가 겹쳐 값을 가리지 않게
    // 이름표는 표시 상자 안에 둔다 — 행 높이가 바뀌어도 상자 모서리에 붙어 따라간다
    if (ai?.area) {
      return (
        <Layer key={clientId} style={style}>
          <AiArea style={areaOf(ai.area)}>
            <AiTag $below={ai.area.start.row === 0}>
              {user.name} · {ai.state === "generating" ? "AI 생성 중" : "AI 검토 중"}
            </AiTag>
          </AiArea>
        </Layer>
      );
    }

    const range = normalizeRange(cursor.active, cursor.extent);
    return (
      <Layer key={clientId} style={style}>
        {!isSingleCell(range) && <Range style={areaOf(range)} />}
        <Pointer style={areaOf(single(cursor.active))} $editing={cursor.editing}>
          <Tag $below={cursor.active.row === 0}>{cursor.editing ? `${user.name} · 입력 중` : user.name}</Tag>
        </Pointer>
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
  top: 0;
  left: 0;
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

// 셀 오른쪽 위 모서리에 붙는 이름표. 첫 행이면 머리글에 가리지 않게 셀 아래로 내린다.
// 포인터 테두리(2px) 안쪽이 기준이라 위·오른쪽을 테두리만큼 밖으로 뺀다.
const Tag = styled.div<{ $below: boolean }>`
  position: absolute;
  ${(p) => (p.$below ? "top: 100%;" : "top: -2px; transform: translateY(-100%);")}
  right: -2px;
  z-index: 2;
  pointer-events: none;
  padding: 1px 6px;
  border-radius: 3px 3px 0 0;
  background: var(--who);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 15px;
  white-space: nowrap;
`;

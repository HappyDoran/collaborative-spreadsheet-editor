"use client";

import { cellKey, type ProposedEdit } from "@sheet/core";
import styled from "styled-components";
import { rectOf, single } from "./gridGeometry";

// AI 제안 미리보기 — 형광펜 칸 위에 원래 값(취소선)과 제안 값 (DESIGN.md 13절).
// 형광펜은 참여자 10색에 없는 표시라 사람의 선택(실선)·복사/입력 중(점선)과 섞이지 않는다.
export function ProposalLayer({ edits, stale }: { edits: ProposedEdit[]; stale: Set<string> }) {
  return edits.map(({ addr, before, after }) => {
    const key = cellKey(addr);
    const changed = stale.has(key);
    return (
      <Box key={key} data-proposal={key} style={rectOf(single(addr))} $stale={changed}>
        {before && <Before>{before}</Before>}
        <After>{after}</After>
        {changed && <Flag title="요청 뒤에 원래 값이 바뀌었어요. 적용할 때 이 칸은 건너뛰어요">!</Flag>}
      </Box>
    );
  });
}

const Box = styled.div<{ $stale: boolean }>`
  position: absolute;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 6px;
  overflow: hidden;
  pointer-events: none;
  background: var(--marker);
  box-shadow: inset 0 -2px var(--marker-edge);
  outline: ${(p) => (p.$stale ? "2px solid var(--danger)" : "none")};
  outline-offset: -2px;
  white-space: nowrap;
`;

const Before = styled.span`
  overflow: hidden;
  color: var(--ink-muted);
  font-size: 9px;
  line-height: 10px;
  text-decoration: line-through;
  text-overflow: ellipsis;
`;

const After = styled.span`
  overflow: hidden;
  color: var(--ink);
  font-weight: 600;
  line-height: 14px;
  text-overflow: ellipsis;
`;

const Flag = styled.span`
  position: absolute;
  top: 1px;
  right: 2px;
  color: var(--danger);
  font-size: 11px;
  font-weight: 700;
`;

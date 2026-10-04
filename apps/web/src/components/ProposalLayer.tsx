"use client";

import { cellKey, mergeAt, type CellRange, type ProposedEdit } from "@sheet/core";
import styled from "styled-components";
import { areaOf, single } from "./gridGeometry";

// AI 제안 미리보기 — 형광펜 칸 위에 원래 값(취소선)과 제안 값 (DESIGN.md 13절).
// 형광펜은 참여자 10색에 없는 표시라 사람의 선택(실선)·복사/입력 중(점선)과 섞이지 않는다.
// 요청 뒤 원래 값이 바뀐 칸(stale: 셀 키 → 지금 값)은 지금 값을 보이고 제안은 흐리게 — 적용할 때 건너뛴다 (X1).
// 병합 칸의 제안은 병합 영역 전체에 그린다
export function ProposalLayer({ edits, stale, merges }: { edits: ProposedEdit[]; stale: Map<string, string>; merges: CellRange[] }) {
  return edits.map(({ addr, before, after }) => {
    const key = cellKey(addr);
    const area = mergeAt(merges, addr) ?? single(addr);
    const now = stale.get(key);
    if (now !== undefined) {
      return (
        <Box key={key} data-proposal={key} style={areaOf(area)} $stale>
          <Now>지금 {now || "빈 칸"} · 건너뜀</Now>
          <After $skipped>{after}</After>
        </Box>
      );
    }
    return (
      <Box key={key} data-proposal={key} style={areaOf(area)} $stale={false}>
        {before && <Before>{before}</Before>}
        <After>{after}</After>
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
  font-size: 11px;
  line-height: 11px;
  text-decoration: line-through;
  text-overflow: ellipsis;
`;

const Now = styled(Before)`
  color: var(--danger);
  font-weight: 600;
  text-decoration: none;
`;

const After = styled.span<{ $skipped?: boolean }>`
  overflow: hidden;
  color: ${(p) => (p.$skipped ? "var(--ink-muted)" : "var(--ink)")};
  font-weight: 600;
  line-height: 14px;
  text-decoration: ${(p) => (p.$skipped ? "line-through" : "none")};
  text-overflow: ellipsis;
`;

"use client";

import { cellKey, type CellAddress, type ProposedEdit } from "@sheet/core";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { useSelectionStore } from "@/stores/selectionStore";
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
        {changed && <Flag title="검토하는 동안 원래 값이 바뀌었어요">!</Flag>}
      </Box>
    );
  });
}

type DecideProps = { edits: ProposedEdit[]; onDecide: (addr: CellAddress, apply: boolean) => void };

// 제안 셀을 선택하면 셀 오른쪽에 그 셀만 결정하는 버튼 (Cursor식 — 변경마다 그 자리에서 결정)
export function ProposalActions({ edits, onDecide }: DecideProps) {
  const { active, mode } = useSelectionStore(useShallow((s) => ({ active: s.active, mode: s.mode })));
  const edit = edits.find((e) => e.addr.row === active.row && e.addr.col === active.col);
  if (!edit || mode !== "idle") return null;
  const rect = rectOf(single(active));
  return (
    // mousedown 기본 동작을 막아 셀 입력칸 포커스를 지킨다 — 결정한 뒤 바로 ⌘Z가 듣게
    <Bar style={{ top: rect.top, left: rect.left + rect.width + 4 }} onMouseDown={(e) => e.preventDefault()}>
      <Act type="button" $primary onClick={() => onDecide(edit.addr, true)}>
        적용
      </Act>
      <Act type="button" onClick={() => onDecide(edit.addr, false)}>
        버리기
      </Act>
    </Bar>
  );
}

const Bar = styled.div`
  position: absolute;
  z-index: 4;
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--marker-edge);
  border-radius: 4px;
  background: var(--paper);
  box-shadow: 0 2px 8px rgb(30 35 40 / 0.16);
`;

const Act = styled.button<{ $primary?: boolean }>`
  height: 20px;
  padding: 0 8px;
  border: 0;
  border-radius: 3px;
  background: ${(p) => (p.$primary ? "var(--ink)" : "transparent")};
  color: ${(p) => (p.$primary ? "#fff" : "var(--ink)")};
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    filter: brightness(0.92);
  }
`;

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

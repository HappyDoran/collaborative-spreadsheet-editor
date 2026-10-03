"use client";

import { isSingleCell, toA1 } from "@sheet/core";
import type { RefObject } from "react";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import type { SheetCommands } from "@/hooks/useSheetCommands";
import { selectedRange, useSelectionStore } from "@/stores/selectionStore";

type Props = {
  commands: SheetCommands;
  activeValue: string;
  proposal?: { before: string; after: string }; // 활성 셀에 대한 AI 제안 (검토 중)
  gridInputRef: RefObject<HTMLInputElement | null>;
};

// 이름 상자 + 값 편집줄. 편집줄을 누르면 엑셀처럼 편집 모드로 들어가고, 셀 입력칸과 같은 초안을 공유한다.
export function FormulaBar({ commands, activeValue, proposal, gridInputRef }: Props) {
  const { active, extent, mode, draft } = useSelectionStore(
    useShallow((s) => ({ active: s.active, extent: s.extent, mode: s.mode, draft: s.draft })),
  );
  const range = selectedRange({ active, extent });
  const backToGrid = () => gridInputRef.current?.focus();

  return (
    <Bar>
      <NameBox aria-label="선택한 셀">{isSingleCell(range) ? toA1(active) : `${toA1(range.start)}:${toA1(range.end)}`}</NameBox>
      <ValueInput
        aria-label="셀 값"
        spellCheck={false}
        value={mode === "idle" ? activeValue : draft}
        onFocus={commands.startEditing}
        onChange={(e) => useSelectionStore.getState().setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            commands.commitAndMove(e.key, e.shiftKey);
            backToGrid();
          } else if (e.key === "Escape") {
            e.preventDefault();
            commands.cancel();
            backToGrid();
          }
        }}
      />
      {proposal && (
        <Proposal title="적용하면 제안 값으로 바뀌어요">
          원래 {proposal.before || "(빈 칸)"} → 제안 {proposal.after || "(빈 값)"}
        </Proposal>
      )}
    </Bar>
  );
}

const Bar = styled.div`
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--rule);
  background: var(--paper);
  height: 30px;
`;

const NameBox = styled.output`
  display: flex;
  align-items: center;
  width: 104px;
  padding: 0 10px;
  border-right: 1px solid var(--rule);
  color: var(--ink-muted);
  font-size: 13px;
`;

const Proposal = styled.span`
  display: flex;
  align-items: center;
  max-width: 40%;
  padding: 0 10px;
  overflow: hidden;
  background: var(--marker);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const ValueInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;

  &:focus {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
`;

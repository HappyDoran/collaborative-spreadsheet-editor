"use client";

import { toA1 } from "@sheet/core";
import type { RefObject } from "react";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import type { SheetCommands } from "@/hooks/useSheetCommands";
import { selectedRange, useSelectionStore } from "@/stores/selectionStore";

type Props = {
  commands: SheetCommands;
  activeValue: string;
  gridInputRef: RefObject<HTMLInputElement | null>;
};

// 이름 상자 + 값 편집줄. 편집줄을 누르면 엑셀처럼 편집 모드로 들어가고, 셀 입력칸과 같은 초안을 공유한다.
export function FormulaBar({ commands, activeValue, gridInputRef }: Props) {
  const { active, extent, mode, draft } = useSelectionStore(
    useShallow((s) => ({ active: s.active, extent: s.extent, mode: s.mode, draft: s.draft })),
  );
  const range = selectedRange({ active, extent });
  const isRange = range.start.row !== range.end.row || range.start.col !== range.end.col;
  const backToGrid = () => gridInputRef.current?.focus();

  return (
    <Bar>
      <NameBox aria-label="선택한 셀">{isRange ? `${toA1(range.start)}:${toA1(range.end)}` : toA1(active)}</NameBox>
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

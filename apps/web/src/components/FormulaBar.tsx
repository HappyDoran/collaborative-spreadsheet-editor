"use client";

import { isSingleCell, toA1 } from "@sheet/core";
import type { RefObject } from "react";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import type { SheetActions } from "@/hooks/useSheet";
import { guardLineBreaks, type SheetCommands } from "@/hooks/useSheetCommands";
import { useAiStore } from "@/stores/aiStore";
import { selectedRange, useSelectionStore } from "@/stores/selectionStore";

type Props = {
  commands: SheetCommands;
  actions: SheetActions; // 활성 셀 값을 읽는다
  gridInputRef: RefObject<HTMLTextAreaElement | null>;
};

// 이름 상자 + 값 편집줄. 편집줄을 누르면 엑셀처럼 편집 모드로 들어가고, 셀 입력칸과 같은 초안을 공유한다.
export function FormulaBar({ commands, actions, gridInputRef }: Props) {
  const { active, extent, mode, draft } = useSelectionStore(
    useShallow((s) => ({ active: s.active, extent: s.extent, mode: s.mode, draft: s.draft })),
  );
  const activeValue = actions.read(active)?.value ?? "";
  // 활성 셀에 대한 AI 제안 (검토 중)
  const proposal = useAiStore((s) => s.edits.find((e) => e.addr.row === active.row && e.addr.col === active.col));
  const range = selectedRange({ active, extent });
  const backToGrid = () => gridInputRef.current?.focus();

  return (
    <Bar>
      <NameBox aria-label="선택한 셀">{isSingleCell(range) ? toA1(active) : `${toA1(range.start)}:${toA1(range.end)}`}</NameBox>
      <ValueInput
        ref={guardLineBreaks}
        aria-label="셀 값"
        spellCheck={false}
        rows={1}
        wrap="off"
        value={mode === "idle" ? activeValue : draft}
        onFocus={commands.startEditing}
        onChange={(e) => useSelectionStore.getState().setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter" && e.altKey) {
            e.preventDefault();
            commands.insertLineBreak(e.currentTarget);
          } else if (e.key === "Enter" || e.key === "Tab") {
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

// 여러 줄 값은 첫 줄만 보인다 — 줄 전체는 셀 편집칸이 펼쳐 보여 준다 (같은 초안)
const ValueInput = styled.textarea`
  flex: 1;
  min-width: 0;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  line-height: 30px;
  white-space: pre;
  overflow: hidden;
  resize: none;

  &:focus {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
`;

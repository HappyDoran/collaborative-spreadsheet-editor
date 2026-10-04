"use client";

import type { SheetActions } from "@/hooks/useSheet";
import { forEachAddress, parseNumber } from "@sheet/core";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { selectedRange, useSelectionStore, type EditMode } from "@/stores/selectionStore";
import { useStatusStore } from "@/stores/statusStore";

// 엑셀 상태 표시줄의 "준비 · 입력 · 편집"과 선택 범위 요약.
const MODE_LABEL: Record<EditMode, string> = { idle: "준비", enter: "입력", edit: "편집" };

export function StatusBar({ actions }: { actions: SheetActions }) {
  const { active, extent, mode } = useSelectionStore(
    useShallow((s) => ({ active: s.active, extent: s.extent, mode: s.mode })),
  );
  const range = selectedRange({ active, extent }, actions.merges());
  const notice = useStatusStore((s) => s.notice);

  let count = 0;
  let numbers = 0;
  let sum = 0;
  forEachAddress(range, (addr) => {
    const value = actions.read(addr)?.value ?? "";
    if (value === "") return;
    count++;
    const n = parseNumber(value); // 정렬과 같은 판정 — 오른쪽 정렬된 칸만 합계에 든다
    if (n !== null) {
      numbers++;
      sum += n;
    }
  });

  return (
    <Bar>
      <Left>
        <span>{MODE_LABEL[mode]}</span>
        <Notice role="status">{notice}</Notice>
      </Left>
      {count > 1 && (
        <Summary>
          {numbers > 0 && <span>합계 {sum.toLocaleString("ko-KR", { maximumFractionDigits: 10 })}</span>}
          {numbers > 0 && <span>평균 {(sum / numbers).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}</span>}
          <span>개수 {count}</span>
        </Summary>
      )}
    </Bar>
  );
}

const Bar = styled.footer`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  border-top: 1px solid var(--rule);
  background: var(--header);
  color: var(--ink-muted);
  font-size: 12px;
`;

const Left = styled.div`
  display: flex;
  gap: 16px;
`;

const Notice = styled.span`
  color: var(--ink);
  font-weight: 600;
`;

const Summary = styled.div`
  display: flex;
  gap: 16px;
`;

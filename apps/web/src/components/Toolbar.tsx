"use client";

import type { CellFormat } from "@sheet/core";
import styled from "styled-components";
import type { SheetCommands } from "@/hooks/useSheetCommands";

type Props = {
  commands: SheetCommands;
  formats: Record<CellFormat, boolean>; // 활성 셀의 현재 서식
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const shortcut = (key: string) => (isMac ? `⌘${key}` : `Ctrl+${key}`);

const FORMAT_BUTTONS: { format: CellFormat; label: string; title: string; key: string }[] = [
  { format: "bold", label: "B", title: "굵게", key: "B" },
  { format: "italic", label: "I", title: "기울임", key: "I" },
  { format: "underline", label: "U", title: "밑줄", key: "U" },
];

// 버튼은 mousedown 기본 동작을 막아 셀 입력칸의 포커스를 빼앗지 않는다.
export function Toolbar({ commands, formats, canUndo, canRedo, onUndo, onRedo }: Props) {
  return (
    <Bar role="toolbar" aria-label="서식" onMouseDown={(e) => e.preventDefault()}>
      <Button type="button" onClick={onUndo} disabled={!canUndo} title={`실행 취소 (${shortcut("Z")})`} aria-label="실행 취소">
        <Icon viewBox="0 0 16 16"><path d="M6 4 2.5 7.5 6 11M3 7.5h6.5a4 4 0 0 1 0 8H8" /></Icon>
      </Button>
      <Button type="button" onClick={onRedo} disabled={!canRedo} title={`다시 실행 (${shortcut(isMac ? "⇧Z" : "Y")})`} aria-label="다시 실행">
        <Icon viewBox="0 0 16 16"><path d="M10 4l3.5 3.5L10 11M13 7.5H6.5a4 4 0 0 0 0 8H8" /></Icon>
      </Button>
      <Divider />
      {FORMAT_BUTTONS.map(({ format, label, title, key }) => (
        <Button
          key={format}
          type="button"
          $format={format}
          aria-pressed={formats[format]}
          title={`${title} (${shortcut(key)})`}
          onClick={() => commands.toggle(format)}
        >
          {label}
        </Button>
      ))}
    </Bar>
  );
}

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--rule);
  background: var(--paper);
`;

const Button = styled.button<{ $format?: CellFormat }>`
  display: grid;
  place-items: center;
  width: 30px;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  font-family: Georgia, "Times New Roman", serif;
  font-weight: ${(p) => (p.$format === "bold" ? 700 : 400)};
  font-style: ${(p) => (p.$format === "italic" ? "italic" : "normal")};
  text-decoration: ${(p) => (p.$format === "underline" ? "underline" : "none")};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--header);
  }
  &[aria-pressed="true"] {
    background: var(--accent-wash);
    color: var(--accent);
  }
  &:disabled {
    color: var(--ink-faint);
    cursor: default;
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
  }
`;

const Icon = styled.svg`
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

const Divider = styled.span`
  width: 1px;
  height: 18px;
  margin: 0 6px;
  background: var(--rule);
`;

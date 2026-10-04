"use client";

import { SHEET_COLS, SHEET_ROWS, anchorOf, colToLabel, inScope, isOneCell, mergeAt, parseNumber, type CellAddress, type CellRange, type ProposedEdit } from "@sheet/core";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactElement, type RefObject } from "react";
import styled from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { guardLineBreaks, type SheetCommands } from "@/hooks/useSheetCommands";
import type { SheetActions } from "@/hooks/useSheet";
import type { Participant } from "@/hooks/usePresence";
import { selectedRange, useSelectionStore } from "@/stores/selectionStore";
import { COL_W, HEADER_W, LINE_H, ROW_H, areaOf, lineCount, rowHeight, single } from "./gridGeometry";
import { shortcut } from "@/hooks/shortcut";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { ProposalLayer } from "./ProposalLayer";
import { RemoteCursors } from "./RemoteCursors";


type Props = {
  actions: SheetActions;
  version: number; // 문서가 바뀔 때마다 증가 — 셀 목록을 다시 만드는 기준
  others: Participant[]; // 다른 참여자 — 선택·편집 중 셀 표시
  proposals: ProposedEdit[]; // 검토 중인 AI 제안
  stale: Map<string, string>; // 요청 뒤 원래 값이 바뀐 제안의 셀 키 → 지금 값
  onOpenAi: () => void; // 우클릭 메뉴의 "AI로 편집…"
  commands: SheetCommands;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

export function Grid({ actions, version, others, proposals, stale, onOpenAi, commands, inputRef }: Props) {
  const { active, extent, copied } = useSelectionStore(
    useShallow((s) => ({ active: s.active, extent: s.extent, copied: s.copied })),
  );
  const { select, selectRange } = useSelectionStore.getState();
  const merges = actions.merges();
  const range = selectedRange({ active, extent }, merges);
  const dragging = useRef(false);
  const proposedRows = new Set(proposals.map((p) => p.addr.row));
  const proposedCols = new Set(proposals.map((p) => p.addr.col));

  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  // 키보드로 화면 밖 셀에 가면 따라 스크롤한다. 고정 머리글 높이·폭은 scroll-padding이 비켜 준다.
  useEffect(() => {
    inputRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, inputRef]);

  const target = (e: MouseEvent) => (e.target as HTMLElement).closest<HTMLElement>("[data-row],[data-col]");
  // 머리글을 누르면 그 열·행 전체를 고른다
  const selectHeader = ({ row, col }: DOMStringMap) => {
    if (col !== undefined) selectRange({ row: 0, col: Number(col) }, { row: SHEET_ROWS - 1, col: Number(col) });
    else if (row !== undefined) selectRange({ row: Number(row), col: 0 }, { row: Number(row), col: SHEET_COLS - 1 });
  };

  const onMouseDown = (e: MouseEvent) => {
    const el = target(e);
    if (e.button === 2) e.preventDefault(); // 우클릭도 셀 입력칸 포커스를 지킨다
    if (!el || e.button !== 0) return;
    e.preventDefault(); // 포커스를 입력칸에 유지
    commands.commit();
    const { row, col } = el.dataset;
    if (row !== undefined && col !== undefined) {
      select({ row: Number(row), col: Number(col) }, e.shiftKey);
      dragging.current = true;
    } else selectHeader(el.dataset);
    inputRef.current?.focus();
  };

  const onMouseOver = (e: MouseEvent) => {
    const el = dragging.current ? target(e) : null;
    if (el?.dataset.row && el.dataset.col) select({ row: Number(el.dataset.row), col: Number(el.dataset.col) }, true);
  };

  // 우클릭 메뉴 (DESIGN.md 14절). 셀 편집 중에는 브라우저 기본 메뉴(글자 복사·맞춤법)를 그대로 둔다.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => {
    setMenu(null);
    inputRef.current?.focus();
  }, [inputRef]);
  const openMenuAtCell = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) setMenu({ x: rect.left + 8, y: rect.bottom });
  }, [inputRef]);

  const onContextMenu = (e: MouseEvent) => {
    if (useSelectionStore.getState().mode !== "idle") return;
    // 메뉴 키는 포커스된 셀 입력칸에서 이벤트가 난다 — 활성 셀 옆에 연다
    if (e.target === inputRef.current) {
      e.preventDefault();
      openMenuAtCell();
      return;
    }
    const el = target(e);
    if (!el) return;
    e.preventDefault();
    commands.commit();
    const { row, col } = el.dataset;
    if (row !== undefined && col !== undefined) {
      // 엑셀처럼: 선택 범위 안이면 범위를 유지, 밖이면 그 셀로 옮긴다
      const addr = { row: Number(row), col: Number(col) };
      if (!inScope(addr, range)) select(addr);
    } else selectHeader(el.dataset);
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const activeCell = actions.read(anchorOf(merges, active));
  const inMerge = merges.some((m) => inScope(m.start, range));
  const menuItems: MenuItem[] = [
    { label: "잘라내기", hint: shortcut("X"), onSelect: () => void commands.copyFromMenu(true) },
    { label: "복사", hint: shortcut("C"), onSelect: () => void commands.copyFromMenu(false) },
    { label: "붙여넣기", hint: shortcut("V"), onSelect: () => void commands.pasteFromMenu() },
    { label: "값만 붙여넣기", hint: shortcut("⇧V"), onSelect: () => void commands.pasteFromMenu("values") },
    { label: "서식만 붙여넣기", onSelect: () => void commands.pasteFromMenu("formats") },
    { label: "내용 지우기", hint: "Delete", separatorBefore: true, onSelect: commands.clearSelection },
    { label: "서식 지우기", hint: shortcut("\\"), onSelect: commands.clearFormatsOfSelection },
    { label: "굵게", hint: shortcut("B"), checked: !!activeCell?.bold, separatorBefore: true, onSelect: () => commands.toggle("bold") },
    { label: "기울임", hint: shortcut("I"), checked: !!activeCell?.italic, onSelect: () => commands.toggle("italic") },
    { label: "밑줄", hint: shortcut("U"), checked: !!activeCell?.underline, onSelect: () => commands.toggle("underline") },
    { label: inMerge ? "병합 해제" : "병합하고 가운데 맞춤", separatorBefore: true, onSelect: commands.toggleMerge },
    { label: "AI로 편집…", hint: shortcut("K"), separatorBefore: true, onSelect: onOpenAi },
  ];

  const onDoubleClick = (e: MouseEvent) => {
    const el = target(e);
    if (!el?.dataset.row || !el.dataset.col) return; // 머리글은 편집하지 않는다
    commands.startEditing();
    inputRef.current?.focus();
  };

  // 선택이 움직일 때는 셀을 다시 읽지 않는다. 문서가 바뀔 때만 다시 만든다.
  // Y.Doc은 바뀌어도 참조가 같아 의존성으로 쓸 수 없다 — 문서 변경마다 오르는 version을 대신 의존성에 둔다
  // (본문에서 쓰지 않으면 린트가 불필요한 의존성으로 보아 void로 읽는다).
  // 행 높이도 같이 정한다 — 그 행에서 줄이 가장 많은 칸에 맞춘다.
  // 병합 칸은 왼쪽 위 칸 하나가 병합 영역 전체를 차지하고, 가려진 칸은 그리지 않는다 — 클릭은 늘 왼쪽 위로 간다.
  const { cells, rowTemplate } = useMemo(() => {
    void version;
    const merged = actions.merges();
    const out: ReactElement[] = [];
    const heights = [ROW_H];
    for (let row = 0; row < SHEET_ROWS; row++) {
      const line = Array.from({ length: SHEET_COLS }, (_, col) => actions.read({ row, col }));
      const spans = Array.from({ length: SHEET_COLS }, (_, col) => mergeAt(merged, { row, col }));
      // 넘침은 빈 칸이면서 병합에 들지 않은 칸으로만 — 병합 칸은 넘치지도, 넘친 글을 받지도 않는다
      const values = line.map((cell, col) => (spans[col] ? "\u0000" : (cell?.value ?? "")));
      let lines = 1;
      line.forEach((cell, col) => {
        const span = spans[col];
        if (span && (span.start.row !== row || span.start.col !== col)) return;
        const value = cell?.value ?? "";
        // 여러 행에 걸친 병합은 행 높이를 정하지 않는다 (엑셀도 병합 칸은 행 높이 자동 맞춤에서 빠진다)
        if (value && (!span || span.end.row === row)) lines = Math.max(lines, lineCount(value));
        out.push(
          <Cell
            key={`${row}:${col}`}
            row={row}
            col={col}
            span={span}
            value={value}
            room={span ? 1 : overflowRoom(values, col)}
            bold={!!cell?.bold}
            italic={!!cell?.italic}
            underline={!!cell?.underline}
          />,
        );
      });
      heights.push(rowHeight(lines));
    }
    return { cells: out, rowTemplate: heights.map((h) => `${h}px`).join(" ") };
  }, [actions, version]);

  return (
    <Scroller>
      <Canvas
        style={{ gridTemplateRows: rowTemplate }}
        onMouseDown={onMouseDown}
        onMouseOver={onMouseOver}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        <Corner
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            commands.commit();
            selectRange({ row: 0, col: 0 }, { row: SHEET_ROWS - 1, col: SHEET_COLS - 1 });
            inputRef.current?.focus();
          }}
        />
        {Array.from({ length: SHEET_COLS }, (_, col) => (
          <ColHeader
            key={col}
            data-col={col}
            $selected={col >= range.start.col && col <= range.end.col}
            $proposed={proposedCols.has(col)}
          >
            {colToLabel(col)}
          </ColHeader>
        ))}
        {Array.from({ length: SHEET_ROWS }, (_, row) => (
          <RowHeader
            key={row}
            data-row={row}
            $selected={row >= range.start.row && row <= range.end.row}
            $proposed={proposedRows.has(row)}
            style={{ gridRow: row + 2 }}
          >
            {row + 1}
          </RowHeader>
        ))}
        {cells}

        <ProposalLayer edits={proposals} stale={stale} merges={merges} />
        <RemoteCursors others={others} merges={merges} />
        {/* 제안이 있는 동안은 선택 배경을 칠하지 않는다 — 형광펜과 섞여 탁해지지 않게 */}
        <RangeBox
          style={areaOf(range)}
          $multi={proposals.length === 0 && !isOneCell(range, merges)}
        />
        {copied && <CopyBox style={areaOf(copied)} />}
        <ActiveInput
          actions={actions}
          commands={commands}
          inputRef={inputRef}
          active={anchorOf(merges, active)}
          area={mergeAt(merges, active) ?? single(active)}
          onOpenMenu={openMenuAtCell}
        />
      </Canvas>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} />}
    </Scroller>
  );
}

// 편집칸은 엑셀처럼 글이 칸보다 길면 오른쪽 칸들을 덮으며 늘어난다 — 가장 긴 줄의 폭을 재 칸 단위로 맞춘다.
// ponytail: 시트 오른쪽 끝에서 멈추고 그 뒤는 칸 안에서 스크롤된다. 엑셀처럼 창 끝에서 줄을 바꾸려면 화면 폭을 알아야 한다
let measure: CanvasRenderingContext2D | null = null;
function editorWidth(draft: string, col: number, bold: boolean, italic: boolean): number {
  measure ??= document.createElement("canvas").getContext("2d");
  if (!measure) return COL_W;
  measure.font = `${italic ? "italic " : ""}${bold ? 700 : 400} 13px ${getComputedStyle(document.body).fontFamily}`;
  const text = Math.max(...draft.split("\n").map((line) => measure!.measureText(line).width));
  const cols = Math.ceil((text + 6 * 2 + 2 * 2 + 4) / COL_W); // 좌우 여백·테두리, 커서 자리
  return Math.min(Math.max(cols, 1), SHEET_COLS - col) * COL_W;
}

// 활성 셀 위에 늘 떠 있는 입력칸. 입력 중 글자마다 그리드 전체가 아니라 이 칸만 다시 그린다.
function ActiveInput({
  actions,
  commands,
  inputRef,
  active,
  area,
  onOpenMenu,
}: Pick<Props, "actions" | "commands" | "inputRef"> & { active: CellAddress; area: CellRange; onOpenMenu: () => void }) {
  const { mode, draft } = useSelectionStore(useShallow((s) => ({ mode: s.mode, draft: s.draft })));
  const cell = actions.read(active);
  useEffect(() => guardLineBreaks(inputRef.current), [inputRef]);
  return (
    <CellInput
      ref={inputRef}
      autoFocus
      aria-label="셀 입력"
      spellCheck={false}
      autoComplete="off"
      wrap="off"
      // textarea는 inset만으로 늘어나지 않아 크기를 직접 준다. 편집 중에는 초안의 줄 수만큼 아래로 펼친다
      // — 확정 전이라 행 높이는 아직 그대로다.
      style={{
        ...areaOf(area),
        width: "100%",
        height: "100%",
        ...(mode !== "idle" && {
          bottom: "auto",
          minHeight: "100%",
          height: rowHeight(lineCount(draft)),
          width: Math.max(editorWidth(draft, active.col, !!cell?.bold, !!cell?.italic), (area.end.col - area.start.col + 1) * COL_W),
        }),
      }}
      $editing={mode !== "idle"}
      $bold={!!cell?.bold}
      $italic={!!cell?.italic}
      $underline={!!cell?.underline}
      value={mode === "idle" ? "" : draft}
      onChange={(e) => commands.onGridChange(e.target.value)}
      onKeyDown={(e) => {
        // Shift+F10: 키보드로 셀 메뉴 열기 (엑셀). 메뉴 키는 contextmenu 이벤트로 온다.
        if (e.shiftKey && e.key === "F10" && mode === "idle") {
          e.preventDefault();
          onOpenMenu();
        } else commands.onGridKeyDown(e);
      }}
      onCopy={(e) => commands.copy(e, false)}
      onCut={(e) => commands.copy(e, true)}
      onPaste={commands.paste}
    />
  );
}

// 엑셀처럼 한 줄 글자는 오른쪽 빈 칸 위로 넘쳐 보인다 — 값이 있는 칸을 만나면 거기서 잘린다.
// 숫자와 여러 줄 값은 넘치지 않는다 (엑셀: 숫자는 넘치지 않고, 셀 안 줄바꿈은 줄 바꿈 서식이 켜진다).
// 서식만 있는 빈 칸은 빈 칸이다. 돌려주는 값은 그 칸을 포함해 글자가 쓸 수 있는 칸 수.
function overflowRoom(values: string[], col: number): number {
  const value = values[col]!;
  if (!value || value.includes("\n") || parseNumber(value) !== null) return 1;
  let room = 1;
  while (col + room < values.length && values[col + room] === "") room++;
  return room;
}

type CellProps = {
  row: number;
  col: number;
  span: CellRange | undefined; // 병합의 왼쪽 위 칸이면 병합 영역
  value: string;
  room: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

// 원시값 props + memo: 문서가 바뀌어도 값·서식·넘칠 자리가 같은 셀은 다시 그리지 않는다.
// 병합 영역은 읽을 때마다 새 객체라 memo 비교가 실패한다 — 병합 칸 수만큼만 다시 그려 문제 되지 않는다.
const Cell = memo(function Cell({ row, col, span, value, room, bold, italic, underline }: CellProps) {
  const overflow = room > 1;
  return (
    <CellBox
      data-row={row}
      data-col={col}
      style={span ? areaOf(span) : { gridRow: row + 2, gridColumn: col + 2 }}
      $merged={!!span}
      $numeric={parseNumber(value) !== null}
      $overflow={overflow}
      $bold={bold}
      $italic={italic}
      $underline={underline}
    >
      {/* 넘친 글자는 옆 칸의 격자선을 종이색으로 가린다(엑셀). 마지막 빈 칸의 오른쪽 선은 남긴다 */}
      {overflow ? <OverflowText style={{ maxWidth: room * COL_W - 1 }}>{value}</OverflowText> : value}
    </CellBox>
  );
});

type FormatProps = { $bold: boolean; $italic: boolean; $underline: boolean };

const Scroller = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--paper);
  scroll-padding: ${ROW_H}px 0 0 ${HEADER_W}px;
`;

const Canvas = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: ${HEADER_W}px repeat(${SHEET_COLS}, ${COL_W}px);
  width: max-content;
  user-select: none;
  cursor: cell;
`;

const header = `
  position: sticky;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--header);
  color: var(--ink-muted);
  font-size: 12px;
  border-right: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  cursor: default;
`;

const Corner = styled.div`
  ${header}
  top: 0;
  left: 0;
  z-index: 4;
  grid-row: 1;
  grid-column: 1;
`;

// 머리글 표시: 선택은 내 색 막대, AI 제안이 있는 행·열은 형광펜 막대
const ColHeader = styled.div<{ $selected: boolean; $proposed: boolean }>`
  ${header}
  top: 0;
  z-index: 3;
  grid-row: 1;
  ${(p) => p.$proposed && "box-shadow: inset 0 -3px var(--marker-edge);"}
  ${(p) => p.$selected && "background: var(--header-selected); color: var(--ink); box-shadow: inset 0 -2px var(--accent);"}
`;

const RowHeader = styled.div<{ $selected: boolean; $proposed: boolean }>`
  ${header}
  left: 0;
  z-index: 3;
  grid-column: 1;
  ${(p) => p.$proposed && "box-shadow: inset -3px 0 var(--marker-edge);"}
  ${(p) => p.$selected && "background: var(--header-selected); color: var(--ink); box-shadow: inset -2px 0 var(--accent);"}
`;

const formatStyles = (p: FormatProps) => `
  font-weight: ${p.$bold ? 700 : 400};
  font-style: ${p.$italic ? "italic" : "normal"};
  text-decoration: ${p.$underline ? "underline" : "none"};
`;

// 셀 안 줄바꿈은 줄을 지킨다. 행보다 줄이 적은 칸은 엑셀처럼 아래에 붙는다.
const cellText = `
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0 6px 3px;
  line-height: ${LINE_H}px;
  white-space: pre;
  overflow: hidden;
  text-overflow: clip;
`;

// 병합 칸은 엑셀의 "병합하고 가운데 맞춤"처럼 가운데 (사람 결정). 배경을 칠해 아래 격자선을 가린다.
const CellBox = styled.div<FormatProps & { $numeric: boolean; $overflow: boolean; $merged: boolean }>`
  ${cellText}
  text-align: ${(p) => (p.$merged ? "center" : p.$numeric ? "right" : "left")};
  ${(p) => p.$merged && "background: var(--paper);"}
  border-right: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  ${formatStyles}
  /* 넘치는 칸은 뒤에 그려지는 옆 칸의 격자선보다 위에. 선택·제안·참여자 표시(z-index 1, 뒤 순서)는 그 위 */
  ${(p) => p.$overflow && "padding: 0; overflow: visible; z-index: 1;"}
`;

// 옆 칸 위의 글자는 클릭을 아래 칸으로 흘려보낸다 — 옆 칸을 눌러도 그 칸이 선택된다
const OverflowText = styled.div`
  ${cellText}
  height: 100%;
  width: max-content;
  background: var(--paper);
  pointer-events: none;
`;

const RangeBox = styled.div<{ $multi: boolean }>`
  position: absolute;
  z-index: 1;
  pointer-events: none;
  background: ${(p) => (p.$multi ? "var(--accent-wash)" : "transparent")};
  outline: 1px solid var(--accent);
  outline-offset: -1px;
`;

const CopyBox = styled.div`
  position: absolute;
  z-index: 2;
  pointer-events: none;
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
`;

// 활성 셀 위에 늘 떠 있는 입력칸. 준비 상태에서는 투명해서 아래 셀 값이 보이고, 입력이 시작되면 셀을 덮는다.
// 셀 안 줄바꿈을 담으려고 textarea다 — input은 값의 줄바꿈을 지운다.
const CellInput = styled.textarea<FormatProps & { $editing: boolean }>`
  position: absolute;
  z-index: 2;
  margin: 0;
  padding: 2px 6px;
  border: 2px solid var(--accent);
  outline: none;
  font: inherit;
  line-height: ${LINE_H}px;
  white-space: pre;
  overflow: hidden;
  resize: none;
  ${formatStyles}
  color: ${(p) => (p.$editing ? "var(--ink)" : "transparent")};
  caret-color: ${(p) => (p.$editing ? "var(--accent)" : "transparent")};
  background: ${(p) => (p.$editing ? "var(--paper)" : "transparent")};
  /* 포커스가 AI 패널 등 다른 곳에 있으면 셀 포인터를 흐리게 — 지금 타이핑이 어디로 가는지 보이게 */
  &:not(:focus) {
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }
  /* 준비 상태에서는 클릭이 아래 셀로 지나가야 선택·더블클릭 편집이 동작한다 */
  pointer-events: ${(p) => (p.$editing ? "auto" : "none")};
  box-shadow: ${(p) => (p.$editing ? "0 2px 8px rgb(30 35 40 / 0.18)" : "none")};
`;

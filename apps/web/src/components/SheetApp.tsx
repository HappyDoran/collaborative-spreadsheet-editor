"use client";

import { useRef } from "react";
import styled from "styled-components";
import { useSheet, type SheetActions } from "@/hooks/useSheet";
import { useSheetCommands } from "@/hooks/useSheetCommands";
import { useSelectionStore } from "@/stores/selectionStore";
import { FormulaBar } from "./FormulaBar";
import { Grid } from "./Grid";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";

const SHEET_ID = "default";

export function SheetApp() {
  const sheet = useSheet(SHEET_ID);
  return (
    <Shell>
      <TitleBar>
        <Title>공동 편집 시트</Title>
      </TitleBar>
      {sheet.status === "loading" ? (
        <Loading>시트를 불러오는 중…</Loading>
      ) : (
        <Editor actions={sheet.actions} version={sheet.version} canUndo={sheet.canUndo} canRedo={sheet.canRedo} />
      )}
    </Shell>
  );
}

type EditorProps = { actions: SheetActions; version: number; canUndo: boolean; canRedo: boolean };

function Editor({ actions, version, canUndo, canRedo }: EditorProps) {
  const commands = useSheetCommands(actions);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = useSelectionStore((s) => s.active);
  const cell = actions.read(active);

  // 버튼으로 실행 취소하면 입력 중이던 내용은 버린다 (엑셀 동작).
  const runHistory = (run: () => void) => {
    commands.cancel();
    run();
    inputRef.current?.focus();
  };

  return (
    <>
      <Toolbar
        commands={commands}
        formats={{ bold: !!cell?.bold, italic: !!cell?.italic, underline: !!cell?.underline }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => runHistory(actions.undo)}
        onRedo={() => runHistory(actions.redo)}
      />
      <FormulaBar commands={commands} activeValue={cell?.value ?? ""} gridInputRef={inputRef} />
      <Grid actions={actions} version={version} commands={commands} inputRef={inputRef} />
      <StatusBar actions={actions} />
    </>
  );
}

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
`;

const TitleBar = styled.header`
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 16px;
  border-bottom: 1px solid var(--rule);
  background: var(--paper);
`;

const Title = styled.h1`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
`;

const Loading = styled.p`
  margin: 0;
  padding: 24px 16px;
  color: var(--ink-muted);
`;

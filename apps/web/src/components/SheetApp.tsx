"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import type { Awareness } from "y-protocols/awareness";
import styled from "styled-components";
import { useIdentity } from "@/hooks/useIdentity";
import { usePresence, useParticipants } from "@/hooks/usePresence";
import { useSheet, type SheetActions } from "@/hooks/useSheet";
import { useSheetCommands } from "@/hooks/useSheetCommands";
import { useNameStore } from "@/stores/identityStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { FormulaBar } from "./FormulaBar";
import { Grid } from "./Grid";
import { NameDialog } from "./NameDialog";
import { ParticipantMenu } from "./ParticipantMenu";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";

const SHEET_ID = "default";

export function SheetApp() {
  const sheet = useSheet(SHEET_ID);
  const { hydrated, name, color } = useIdentity();

  return (
    // 내 색이 곧 내 셀 포인터·선택 색이다 (DESIGN.md 12절). 색을 고르기 전에는 흐린 먹색.
    <Shell style={{ "--accent": color ?? "var(--ink-muted)" } as CSSProperties}>
      {sheet.status === "loading" ? (
        <>
          <TitleBar />
          <Loading>시트를 불러오는 중…</Loading>
        </>
      ) : (
        <Editor {...sheet} name={name} color={color} />
      )}
      {hydrated && !name && <NameDialog onSubmit={useNameStore.getState().setName} />}
    </Shell>
  );
}

type EditorProps = {
  actions: SheetActions;
  awareness: Awareness;
  version: number;
  canUndo: boolean;
  canRedo: boolean;
  name: string | null;
  color: string | null;
};

function Editor({ actions, awareness, version, canUndo, canRedo, name, color }: EditorProps) {
  usePresence(awareness, name, color);
  const participants = useParticipants(awareness);
  const commands = useSheetCommands(actions);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = useSelectionStore((s) => s.active);
  const cell = actions.read(active);
  const { setName, clearName } = useNameStore.getState();

  // 버튼으로 실행 취소하면 입력 중이던 내용은 버린다 (엑셀 동작).
  const runHistory = (run: () => void) => {
    commands.cancel();
    run();
    inputRef.current?.focus();
  };

  return (
    <>
      <TitleBar>
        <ParticipantMenu participants={participants} onRename={setName} onClearName={clearName} />
      </TitleBar>
      <Toolbar
        commands={commands}
        formats={{ bold: !!cell?.bold, italic: !!cell?.italic, underline: !!cell?.underline }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => runHistory(actions.undo)}
        onRedo={() => runHistory(actions.redo)}
      />
      <FormulaBar commands={commands} activeValue={cell?.value ?? ""} gridInputRef={inputRef} />
      <Grid
        actions={actions}
        version={version}
        others={participants.filter((p) => !p.isSelf)}
        commands={commands}
        inputRef={inputRef}
      />
      <StatusBar actions={actions} />
    </>
  );
}

function TitleBar({ children }: { children?: ReactNode }) {
  return (
    <Header>
      <Title>공동 편집 시트</Title>
      {children}
    </Header>
  );
}

const Shell = styled.div`
  --accent-wash: color-mix(in srgb, var(--accent) 10%, transparent);
  --header-selected: color-mix(in srgb, var(--accent) 12%, var(--header));
  display: flex;
  flex-direction: column;
  height: 100dvh;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  height: 48px;
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

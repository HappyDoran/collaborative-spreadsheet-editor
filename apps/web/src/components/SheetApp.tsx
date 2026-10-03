"use client";

import { cellKey, staleEdits } from "@sheet/core";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Awareness } from "y-protocols/awareness";
import styled from "styled-components";
import { useAiEdit } from "@/hooks/useAiEdit";
import { useIdentity } from "@/hooks/useIdentity";
import { usePresence, useParticipants } from "@/hooks/usePresence";
import { useSheet, type SheetActions } from "@/hooks/useSheet";
import { useSheetCommands } from "@/hooks/useSheetCommands";
import { useAiStore } from "@/stores/aiStore";
import { readLastName, useNameStore } from "@/stores/identityStore";
import { useSelectionStore } from "@/stores/selectionStore";
import { AiPanel } from "./AiPanel";
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
      {hydrated && !name && <NameDialog defaultName={readLastName()} onSubmit={useNameStore.getState().setName} />}
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
  const ai = useAiEdit(actions);
  const aiOpen = useAiStore((s) => s.open);
  const proposals = useAiStore((s) => s.edits);
  const read = (addr: Parameters<typeof actions.read>[0]) => actions.read(addr)?.value ?? "";
  const stale = new Set(staleEdits(proposals, read).map((e) => cellKey(e.addr)));
  const activeProposal = proposals.find((p) => p.addr.row === active.row && p.addr.col === active.col);
  const debug = useDebugMode();

  // 이름을 정하고 입력 화면이 닫히면 바로 시트에 입력할 수 있게 그리드로 포커스를 옮긴다
  useEffect(() => {
    if (name) inputRef.current?.focus();
  }, [name]);

  // ⌘K / Ctrl+K: 닫혀 있으면 열고 입력칸으로, 입력칸에 있으면 닫고 그리드로 (DESIGN.md 13절)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      const input = document.getElementById("ai-input");
      if (useAiStore.getState().open && document.activeElement === input) {
        useAiStore.setState({ open: false });
        inputRef.current?.focus();
      } else {
        useAiStore.setState({ open: true });
        requestAnimationFrame(() => document.getElementById("ai-input")?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 버튼으로 실행 취소하면 입력 중이던 내용은 버린다 (엑셀 동작).
  const runHistory = (run: () => void) => {
    commands.cancel();
    run();
    inputRef.current?.focus();
  };

  return (
    <>
      <TitleBar debug={debug}>
        <ParticipantMenu participants={participants} onRename={setName} onClearName={clearName} />
      </TitleBar>
      <Toolbar
        commands={commands}
        formats={{ bold: !!cell?.bold, italic: !!cell?.italic, underline: !!cell?.underline }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => runHistory(actions.undo)}
        onRedo={() => runHistory(actions.redo)}
        aiOpen={aiOpen}
        onToggleAi={() => {
          useAiStore.setState({ open: !aiOpen });
          if (!aiOpen) requestAnimationFrame(() => document.getElementById("ai-input")?.focus());
        }}
      />
      <FormulaBar
        commands={commands}
        activeValue={cell?.value ?? ""}
        proposal={activeProposal?.after}
        gridInputRef={inputRef}
      />
      <Workspace>
        <Grid
          actions={actions}
          version={version}
          others={participants.filter((p) => !p.isSelf)}
          proposals={proposals}
          stale={stale}
          commands={commands}
          inputRef={inputRef}
        />
        <AiPanel open={aiOpen} ai={ai} staleCount={stale.size} gridInputRef={inputRef} />
      </Workspace>
      <StatusBar actions={actions} />
    </>
  );
}

// 디버깅 버튼은 개발 환경이거나 주소에 ?debug=1이 있을 때만 (DESIGN.md 13절). 개발 환경은 가짜 응답으로 시작한다.
function useDebugMode() {
  const [debug] = useState(
    () => process.env.NODE_ENV !== "production" || new URLSearchParams(window.location.search).has("debug"),
  );
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") useAiStore.setState({ mock: true });
  }, []);
  return debug;
}

function TitleBar({ children, debug = false }: { children?: ReactNode; debug?: boolean }) {
  const mock = useAiStore((s) => s.mock);
  return (
    <Header>
      {debug && (
        <DebugToggle
          type="button"
          aria-pressed={mock}
          title="디버깅: AI 응답을 가짜/실제로 바꿔요"
          onClick={() => useAiStore.setState({ mock: !mock })}
        >
          {mock ? "가짜 응답" : "실제 AI"}
        </DebugToggle>
      )}
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

const Workspace = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
`;

const DebugToggle = styled.button`
  height: 24px;
  margin-right: 12px;
  padding: 0 8px;
  border: 1px dashed var(--ink-muted);
  border-radius: 4px;
  background: transparent;
  color: var(--ink-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;

  &[aria-pressed="true"] {
    border-style: solid;
    border-color: var(--marker-edge);
    background: var(--marker);
    color: var(--ink);
  }
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

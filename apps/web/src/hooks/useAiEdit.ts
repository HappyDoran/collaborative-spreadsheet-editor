"use client";

import { judgeEdit, sheetContext, type AiScope, type CellAddress, type ProposedEdit } from "@sheet/core";
import { useEffect, useMemo, useRef } from "react";
import { AbortedByUser, streamAiEdit } from "@/ai/streamAiEdit";
import { appendAiText, endRun, pushMessage, useAiStore } from "@/stores/aiStore";
import { selectedRange, useSelectionStore } from "@/stores/selectionStore";
import type { SheetActions } from "./useSheet";

// 지금 선택과 대상 설정으로 AI 대상 범위를 정한다. auto: 여러 칸이면 그 범위, 한 칸이면 시트 전체.
export function resolveScope(mode: "auto" | "selection" | "sheet"): AiScope {
  const range = selectedRange(useSelectionStore.getState());
  const multi = range.start.row !== range.end.row || range.start.col !== range.end.col;
  if (mode === "sheet" || (mode === "auto" && !multi)) return null;
  return range;
}

const sameCell = (a: CellAddress, b: CellAddress) => a.row === b.row && a.col === b.col;

// 같은 셀이 다시 오면 나중 제안으로 바꾼다
function upsert(edits: ProposedEdit[], edit: ProposedEdit) {
  const i = edits.findIndex((e) => sameCell(e.addr, edit.addr));
  return i < 0 ? [...edits, edit] : edits.map((e, j) => (j === i ? edit : e));
}

// AI 편집 흐름: 보내기 → 받기(셀 판정) → 검토 → 적용·버리기 (DESIGN.md 13절)
export function useAiEdit(actions: SheetActions) {
  const controller = useRef<AbortController | null>(null);
  // 새로고침·이동으로 페이지를 떠나는 중. 그때 끊긴 요청은 실패가 아니다 — 상태를 그대로 두면
  // 다음 로드에서 "새로고침으로 생성이 멈췄어요."로 정리된다 (stores/aiStore의 merge).
  const leaving = useRef(false);

  // 이 탭에 남겨 둔 제안·대화를 읽어 온다 (새로고침해도 검토를 이어 갈 수 있게).
  useEffect(() => {
    void useAiStore.persist.rehydrate();
    const markLeaving = () => (leaving.current = true);
    window.addEventListener("beforeunload", markLeaving);
    window.addEventListener("pagehide", markLeaving);
    return () => {
      window.removeEventListener("beforeunload", markLeaving);
      window.removeEventListener("pagehide", markLeaving);
      controller.current?.abort();
    };
  }, []);

  return useMemo(() => {
    const read = (addr: CellAddress) => actions.read(addr)?.value ?? "";
    const state = useAiStore.getState;

    const finish = () => {
      const { edits, excluded, scope } = state();
      if (excluded) {
        pushMessage({
          role: "notice",
          text: scope
            ? `대상 범위 밖이거나 주소가 잘못된 제안 ${excluded}개는 제외했어요.`
            : `주소가 잘못된 제안 ${excluded}개는 제외했어요.`,
        });
      }
      if (edits.length) useAiStore.setState({ status: "review" });
      else {
        pushMessage({ role: "notice", text: "AI는 셀을 바꾸지 않았어요." });
        endRun();
      }
    };

    const send = async (input: string) => {
      const instruction = input.trim();
      if (!instruction || state().status !== "idle") return;
      const scope = resolveScope(state().scopeMode);
      const { text: context } = sheetContext(read, scope);
      pushMessage({ role: "user", text: instruction });
      useAiStore.setState({ status: "reading", scope, edits: [], excluded: 0, lastInstruction: instruction });

      const ctrl = new AbortController();
      controller.current = ctrl;
      try {
        await streamAiEdit(
          { instruction, scope, context, mock: state().mock, model: state().model },
          {
            signal: ctrl.signal,
            onEvent: (event) => {
              if (event.type === "reply") appendAiText(event.text);
              else if (event.type === "edit") {
                const verdict = judgeEdit(event.cell, event.value, scope, read);
                if (verdict.ok) useAiStore.setState((s) => ({ status: "streaming", edits: upsert(s.edits, verdict.edit) }));
                else if (verdict.reason !== "unchanged") useAiStore.setState((s) => ({ excluded: s.excluded + 1 }));
              } else if (event.type === "done") finish();
              else if (!leaving.current) {
                pushMessage({ role: "error", code: event.code });
                endRun();
              }
            },
          },
        );
      } catch (error) {
        if (!(error instanceof AbortedByUser)) throw error;
        if (leaving.current) return;
        pushMessage({ role: "notice", text: "생성을 멈췄어요. 시트는 바뀌지 않았어요." });
        endRun();
      } finally {
        controller.current = null;
      }
    };

    return {
      send,
      stop: () => controller.current?.abort(),
      retry: () => void send(state().lastInstruction),
      // 제안 전체를 한 번에 결정한다 (DESIGN.md 13절). 적용은 transaction 하나 = 실행 취소 한 번 (A5).
      apply: () => {
        const { edits } = state();
        actions.setValues(edits.map(({ addr, after }) => ({ addr, value: after })));
        pushMessage({ role: "notice", text: `${edits.length}개 셀에 적용했어요. ⌘Z로 한 번에 되돌릴 수 있어요.` });
        endRun();
      },
      discard: () => {
        pushMessage({ role: "notice", text: "제안을 버렸어요." });
        endRun();
      },
    };
  }, [actions]);
}

export type AiCommands = ReturnType<typeof useAiEdit>;

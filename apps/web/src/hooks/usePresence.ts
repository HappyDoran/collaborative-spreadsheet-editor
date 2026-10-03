"use client";

import { pickColor, type CellRange, type PresenceState } from "@sheet/core";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Awareness } from "y-protocols/awareness";
import { useAiStore } from "@/stores/aiStore";
import { useColorStore } from "@/stores/identityStore";
import { useSelectionStore } from "@/stores/selectionStore";

// 합류 직후 다른 탭의 참여자 상태가 도착할 시간을 준 뒤 색을 고른다 (DESIGN.md 12절).
const COLOR_PICK_DELAY_MS = 150;

// 내 이름·색·선택을 awareness로 알린다. 이름이 없으면 목록에서 빠진다.
export function usePresence(awareness: Awareness, name: string | null, color: string | null) {
  useEffect(() => {
    if (color) return;
    const timer = setTimeout(() => {
      const used = othersOf(awareness).map(([, s]) => s.user.color);
      useColorStore.getState().setColor(pickColor(used));
    }, COLOR_PICK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [awareness, color]);

  useEffect(() => {
    if (!name || !color) {
      awareness.setLocalState(null);
      return;
    }
    const cursorOf = (s: ReturnType<typeof useSelectionStore.getState>): PresenceState["cursor"] => ({
      active: s.active,
      extent: s.extent,
      editing: s.mode !== "idle",
    });
    const state: PresenceState = {
      user: { name, color },
      cursor: cursorOf(useSelectionStore.getState()),
      ai: aiOf(useAiStore.getState()),
    };
    awareness.setLocalState(state);
    const offSelection = useSelectionStore.subscribe((s, prev) => {
      if (s.active === prev.active && s.extent === prev.extent && (s.mode === "idle") === (prev.mode === "idle")) return;
      awareness.setLocalStateField("cursor", cursorOf(s));
    });
    const offAi = useAiStore.subscribe((s, prev) => {
      if (s.status !== prev.status || s.edits !== prev.edits) awareness.setLocalStateField("ai", aiOf(s));
    });
    return () => {
      offSelection();
      offAi();
    };
  }, [awareness, name, color]);
}

const NO_PARTICIPANTS: Participant[] = [];

function aiOf(s: ReturnType<typeof useAiStore.getState>): PresenceState["ai"] {
  if (s.status === "idle") return null;
  if (s.status !== "review") return { state: "generating", area: s.scope };
  return { state: "reviewing", area: boundsOf(s.edits.map((e) => e.addr)) };
}

function boundsOf(cells: { row: number; col: number }[]): CellRange | null {
  if (!cells.length) return null;
  const rows = cells.map((c) => c.row);
  const cols = cells.map((c) => c.col);
  return {
    start: { row: Math.min(...rows), col: Math.min(...cols) },
    end: { row: Math.max(...rows), col: Math.max(...cols) },
  };
}

export type Participant = PresenceState & { clientId: number; isSelf: boolean };

function othersOf(awareness: Awareness): [number, PresenceState][] {
  return [...awareness.getStates()].filter(
    (entry): entry is [number, PresenceState] => entry[0] !== awareness.clientID && !!entry[1]?.user,
  );
}

// 접속 중인 참여자 목록 (나 먼저). 같은 이름도 그대로 둔다 — 탭마다 다른 색이 구분한다.
export function useParticipants(awareness: Awareness): Participant[] {
  const store = useMemo(() => {
    let snapshot: Participant[] = [];
    const compute = () => {
      snapshot = [...awareness.getStates()]
        .filter((entry): entry is [number, PresenceState] => !!entry[1]?.user)
        .map(([clientId, s]) => ({ ...s, clientId, isSelf: clientId === awareness.clientID }))
        .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.clientId - b.clientId);
    };
    compute();
    return {
      subscribe(onChange: () => void) {
        // 구독 전에 일어난 변경(새로고침 직후 저장된 이름으로 바로 합류)도 놓치지 않게 지금 상태로 다시 계산한다.
        // React는 구독 직후 getSnapshot을 다시 비교하므로 바뀐 목록이 그려진다.
        compute();
        const handler = () => {
          compute();
          onChange();
        };
        awareness.on("change", handler);
        return () => awareness.off("change", handler);
      },
      get: () => snapshot,
    };
  }, [awareness]);
  return useSyncExternalStore(store.subscribe, store.get, () => NO_PARTICIPANTS);
}

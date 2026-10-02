import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";

// 같은 브라우저 탭끼리 BroadcastChannel로 문서·참여자 상태를 주고받는다 (DESIGN.md 11절).
// 네트워크 동기화로 확장할 때는 이 파일을 WebSocket 기반 provider로 바꾼다 — 메시지 종류는 그대로다.
type Message =
  | { type: "hello"; stateVector: Uint8Array } // 합류 인사: "나는 여기까지 안다"
  | { type: "update"; update: Uint8Array } // 문서 변경 (또는 인사에 대한 모자란 부분)
  | { type: "awareness"; update: Uint8Array }; // 참여자 상태 변경

// 다른 탭에서 받은 변경의 표식. 다시 방송하지 않고, UndoManager도 추적하지 않는다.
export const REMOTE = Symbol("remote");

export function connectBroadcast(channelName: string, doc: Y.Doc, awareness: Awareness): () => void {
  const channel = new BroadcastChannel(channelName);
  const post = (m: Message) => channel.postMessage(m);
  const postAwareness = (clients: number[]) =>
    post({ type: "awareness", update: encodeAwarenessUpdate(awareness, clients) });

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== REMOTE) post({ type: "update", update });
  };
  const onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin !== REMOTE) postAwareness([...added, ...updated, ...removed]);
  };

  channel.onmessage = ({ data }: MessageEvent<Message>) => {
    if (data.type === "update") Y.applyUpdate(doc, data.update, REMOTE);
    else if (data.type === "awareness") applyAwarenessUpdate(awareness, data.update, REMOTE);
    else {
      // 새 탭에게 모자란 문서 부분과 내 참여자 상태를 답한다
      post({ type: "update", update: Y.encodeStateAsUpdate(doc, data.stateVector) });
      if (awareness.getLocalState()) postAwareness([doc.clientID]);
    }
  };

  doc.on("update", onDocUpdate);
  awareness.on("update", onAwarenessUpdate);
  post({ type: "hello", stateVector: Y.encodeStateVector(doc) });

  // 탭을 닫거나 떠날 때 목록에서 바로 빠진다 (C6). 방송 못 하고 죽은 탭은 awareness 30초 만료가 정리한다.
  let hiddenState: unknown = null;
  const onPageHide = () => {
    hiddenState = awareness.getLocalState();
    removeAwarenessStates(awareness, [doc.clientID], "pagehide");
  };
  // 뒤로 가기 캐시에서 돌아오면 다시 합류한다.
  const onPageShow = (e: PageTransitionEvent) => {
    if (!e.persisted || !hiddenState) return;
    awareness.setLocalState(hiddenState as Record<string, unknown>);
    post({ type: "hello", stateVector: Y.encodeStateVector(doc) });
  };
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);

  return () => {
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    removeAwarenessStates(awareness, [doc.clientID], "disconnect");
    doc.off("update", onDocUpdate);
    awareness.off("update", onAwarenessUpdate);
    channel.close();
  };
}

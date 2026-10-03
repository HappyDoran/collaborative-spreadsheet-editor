import { IndexeddbPersistence } from "y-indexeddb";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import { connectBroadcast } from "./broadcastProvider";

// 시트 하나의 공유 문서와 그 전송·영속 연결. 네트워크 동기화로 바꿀 때 교체하는 곳은 이 폴더다.
export type SheetSession = {
  doc: Y.Doc;
  awareness: Awareness; // 참여자 이름·색·선택 — 탭이 닫히면 사라지는 공유 상태
  // 이 탭의 로컬 변경 표식. UndoManager가 이 origin만 추적한다 (TECH_RULES.md 4절).
  origin: symbol;
  whenReady: Promise<void>;
  destroy: () => void;
};

// 문서 스키마 판. 스키마를 바꾸면 올린다 — 옛 저장본·옛 코드의 탭과 섞이지 않게 저장소와 채널 이름이 달라진다.
// v2: 셀마다 중첩 맵 → 필드별 최상위 맵 (DESIGN.md 8절).
const SCHEMA = "v2";

export function openSheetSession(sheetId: string): SheetSession {
  const name = `sheet:${SCHEMA}:${sheetId}`;
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  awareness.setLocalState(null); // 이름이 정해질 때까지 참여자 목록에 나타나지 않는다
  const persistence = new IndexeddbPersistence(name, doc);
  // 저장본을 먼저 읽고 나서 다른 탭과 인사한다 — 인사에 실을 state vector가 정확해진다.
  let disconnect = () => {};
  let destroyed = false;
  const whenReady = persistence.whenSynced.then(() => {
    if (!destroyed) disconnect = connectBroadcast(name, doc, awareness);
  });
  return {
    doc,
    awareness,
    origin: Symbol("local-edit"),
    whenReady,
    destroy: () => {
      destroyed = true;
      disconnect();
      awareness.destroy();
      void persistence.destroy();
      doc.destroy();
    },
  };
}

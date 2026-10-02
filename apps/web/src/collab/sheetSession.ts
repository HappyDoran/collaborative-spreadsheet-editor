import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";

// 시트 하나의 공유 문서와 그 전송·영속 연결. 네트워크 동기화로 바꿀 때 교체하는 곳은 이 파일이다.
export type SheetSession = {
  doc: Y.Doc;
  // 이 탭의 로컬 변경 표식. UndoManager가 이 origin만 추적한다 (TECH_RULES.md 4절).
  origin: symbol;
  whenReady: Promise<void>;
  destroy: () => void;
};

export function openSheetSession(sheetId: string): SheetSession {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`sheet:${sheetId}`, doc);
  return {
    doc,
    origin: Symbol("local-edit"),
    whenReady: persistence.whenSynced.then(() => undefined),
    destroy: () => {
      void persistence.destroy();
      doc.destroy();
    },
  };
}

import { parseA1, type CellAddress } from "../address";
import { isInsideSheet } from "../sheet";
import type { AiScope, ProposedEdit } from "./types";

type Read = (addr: CellAddress) => string;

export function inScope({ row, col }: CellAddress, scope: AiScope): boolean {
  if (!scope) return true;
  return row >= scope.start.row && row <= scope.end.row && col >= scope.start.col && col <= scope.end.col;
}

// 두 AI 대상이 겹치는가 (X3 경고). null은 시트 전체라 무엇과도 겹친다.
export function scopesOverlap(a: AiScope, b: AiScope): boolean {
  if (!a || !b) return true;
  return a.start.row <= b.end.row && b.start.row <= a.end.row && a.start.col <= b.end.col && b.start.col <= a.end.col;
}

export type EditVerdict =
  | { ok: true; edit: ProposedEdit }
  | { ok: false; reason: "invalid" | "outside" | "unchanged" };

// 모델이 보낸 셀 하나를 제안으로 받을지 판정한다. 모델 출력은 신뢰 경계 밖이다 (TECH_RULES.md 5절).
// read는 요청을 보낸 순간의 값을 돌려줘야 한다 — AI는 그 값을 보고 계산했고, before가 X1 판정의 기준이 된다.
export function judgeEdit(cell: string, value: string, scope: AiScope, read: Read): EditVerdict {
  const addr = parseA1(cell);
  if (!addr) return { ok: false, reason: "invalid" };
  if (!isInsideSheet(addr) || !inScope(addr, scope)) return { ok: false, reason: "outside" };
  const before = read(addr);
  if (before === value) return { ok: false, reason: "unchanged" };
  return { ok: true, edit: { addr, before, after: value } };
}

// 검토 중에 원래 값이 바뀐 제안 (내 수정, 실행 취소, 다른 탭의 변경)
export function staleEdits(edits: ProposedEdit[], read: Read): ProposedEdit[] {
  return edits.filter((e) => read(e.addr) !== e.before);
}

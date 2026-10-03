import { parseA1, type CellAddress } from "../address";
import { isInsideSheet } from "../sheet";
import type { AiScope, ProposedEdit } from "./types";

type Read = (addr: CellAddress) => string;

export function inScope({ row, col }: CellAddress, scope: AiScope): boolean {
  if (!scope) return true;
  return row >= scope.start.row && row <= scope.end.row && col >= scope.start.col && col <= scope.end.col;
}

export type EditVerdict =
  | { ok: true; edit: ProposedEdit }
  | { ok: false; reason: "invalid" | "outside" | "unchanged" };

// 모델이 보낸 셀 하나를 제안으로 받을지 판정한다. 모델 출력은 신뢰 경계 밖이다 (TECH_RULES.md 5절).
// before는 지금 값 — 요청 시점의 원래 값으로 남아, 검토 중 바뀌었는지 판정하는 기준이 된다.
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

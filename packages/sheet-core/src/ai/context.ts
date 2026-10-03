import { toA1, type CellAddress } from "../address";
import { SHEET_COLS, SHEET_ROWS } from "../sheet";
import { inScope } from "./proposal";
import type { AiScope } from "./types";

// AI에게 보낼 셀 수 상한 — 요청 하나가 커지는 것을 막는다 (DESIGN.md 13절 남용 방지).
export const AI_CONTEXT_MAX_CELLS = 600;

// 값이 있는 셀만 `주소: "값"` 한 줄씩. 대상 범위 안의 셀을 먼저 넣고, 상한을 넘으면 나머지는 뺀다.
// 값은 JSON 문자열로 감싸 줄바꿈·따옴표가 줄 구분을 깨지 않게 한다.
export function sheetContext(read: (addr: CellAddress) => string, scope: AiScope) {
  const inside: string[] = [];
  const outside: string[] = [];
  for (let row = 0; row < SHEET_ROWS; row++) {
    for (let col = 0; col < SHEET_COLS; col++) {
      const value = read({ row, col });
      if (value === "") continue;
      (inScope({ row, col }, scope) ? inside : outside).push(`${toA1({ row, col })}: ${JSON.stringify(value)}`);
    }
  }
  const lines = [...inside, ...outside];
  return { text: lines.slice(0, AI_CONTEXT_MAX_CELLS).join("\n"), truncated: lines.length > AI_CONTEXT_MAX_CELLS };
}

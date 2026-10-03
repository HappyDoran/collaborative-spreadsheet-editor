import type { CellAddress, CellRange } from "./address";

// 흰 글자 대비 4.5:1 이상, 종이색 위 2px 테두리로 구분되는 10색 (DESIGN.md 12절).
export const PARTICIPANT_COLORS = [
  "#2735C4", // 군청
  "#C2410C", // 주홍
  "#0F766E", // 청록
  "#BE185D", // 자홍
  "#7C3AED", // 보라
  "#15803D", // 초록
  "#A16207", // 황토
  "#0369A1", // 하늘
  "#4D7C0F", // 올리브
  "#86198F", // 자두
] as const;

export const NAME_MAX_LENGTH = 20;

// awareness로 다른 탭에 알리는 내 상태
export type PresenceState = {
  user: { name: string; color: string };
  cursor: { active: CellAddress; extent: CellAddress; editing: boolean } | null;
  // AI 생성·검토 중인 범위 (DESIGN.md 13절 D안). 제안 값은 싣지 않는다 — 확정 값으로 오해하지 않게.
  // area: 생성 중이면 대상 범위, 검토 중이면 남은 제안을 감싸는 범위. null = 시트 전체.
  ai: { state: "generating" | "reviewing"; area: CellRange | null } | null;
};

// 쓰이지 않은 색 중 무작위. 전부 쓰였으면 전체에서 무작위.
export function pickColor(used: Iterable<string>, random: () => number = Math.random): string {
  const taken = new Set(Array.from(used, (c) => c.toUpperCase()));
  const free = PARTICIPANT_COLORS.filter((c) => !taken.has(c));
  const pool = free.length ? free : PARTICIPANT_COLORS;
  return pool[Math.floor(random() * pool.length)]!;
}

// 앞뒤 공백 제거, 연속 공백 하나로, 최대 길이. 비면 null.
export function normalizeName(input: string): string | null {
  const name = Array.from(input.trim().replace(/\s+/g, " ")).slice(0, NAME_MAX_LENGTH).join("");
  return name || null;
}

// 새 탭의 이름 입력 화면에 미리 채울 이름. 마지막에 쓴 이름이 지금 접속 중이면 뒤에 번호를 붙여 제안한다
// (같은 이름은 허용하지만, Enter 한 번으로 같은 이름이 둘 생기지 않게). 사용자가 고쳐 쓰면 그대로 쓴다.
export function suggestName(last: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!last || !used.has(last)) return last;
  for (let n = 2; ; n++) {
    const name = `${Array.from(last).slice(0, NAME_MAX_LENGTH - String(n).length - 1).join("")} ${n}`;
    if (!used.has(name)) return name;
  }
}

// 아바타에 넣을 첫 글자. 한글·이모지도 한 글자로 자른다.
export function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? "?").toUpperCase();
}

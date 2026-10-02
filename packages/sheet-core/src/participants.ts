import type { CellAddress } from "./address";

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
  user: { name: string; color: string; joinedAt: number }; // joinedAt: 이 탭이 합류한 시각(ms)
  cursor: { active: CellAddress; extent: CellAddress; editing: boolean } | null;
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

// 아바타에 넣을 첫 글자. 한글·이모지도 한 글자로 자른다.
export function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? "?").toUpperCase();
}

// 같은 이름이 여럿이면 합류 순서대로 "이름 2", "이름 3"을 붙인다. 모든 탭에서 같은 번호가 나온다.
// Yjs clientID는 무작위라 순서로 쓸 수 없다 — 합류 시각으로 정렬하고, 같으면 clientId로 끊는다.
export function labelParticipants<T extends { clientId: number; name: string; joinedAt: number }>(
  list: T[],
): (T & { label: string })[] {
  const seen = new Map<string, number>();
  const labels = new Map<number, string>();
  for (const p of [...list].sort((a, b) => a.joinedAt - b.joinedAt || a.clientId - b.clientId)) {
    const n = (seen.get(p.name) ?? 0) + 1;
    seen.set(p.name, n);
    labels.set(p.clientId, n === 1 ? p.name : `${p.name} ${n}`);
  }
  return list.map((p) => ({ ...p, label: labels.get(p.clientId)! }));
}

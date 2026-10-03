// 셀 글자를 숫자로 읽는다 — 정렬(오른쪽)과 상태 표시줄 합계가 같은 판정을 쓴다.
// 허용: 부호, 천 단위 쉼표(세 자리씩), 소수, 끝의 % (100으로 나눈다). 숫자가 하나는 있어야 한다.
// 1e3·0x10·Infinity처럼 Number()만 통과하는 표기는 글자로 본다 — 표에서 사람이 쓰는 숫자가 아니다.
const NUMBER = /^[-+]?(\d{1,3}(,\d{3})*(\.\d+)?|\d+(\.\d+)?|\.\d+)%?$/;

export function parseNumber(text: string): number | null {
  const t = text.trim();
  if (!NUMBER.test(t)) return null;
  const n = Number(t.replace(/[,%]/g, ""));
  return t.endsWith("%") ? n / 100 : n;
}

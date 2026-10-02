import { toA1 } from "@sheet/core";

export default function Home() {
  return <main>시트 준비 중 — 첫 셀 {toA1({ row: 0, col: 0 })}</main>;
}

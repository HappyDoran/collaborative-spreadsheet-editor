---
title: 프롬프트 기록
kind: history
last_verified: 2026-10-02
---

# 프롬프트 기록

재사용할 프롬프트와 결과가 기대와 크게 달랐던 프롬프트를 발생 시점에 적는다. `LLM_REPORT.md` 4절은 여기서 2~3개를 골라 옮긴다. 원문이 길면 요지만 적고, 개인정보와 비밀은 적지 않는다.

형식: 날짜 · 단계 · 프롬프트 요지 · 결과 · 판정(잘 됨 / 실패 / 보완) · 이유.

## P1 — 골격과 Agent 작업 지원 체계를 먼저 세우기 (2026-10-02, 착수)

- **프롬프트 요지**: "골격부터 만들되, 기능 구현 전에 Agent 작업 지원 체계를 정해진 순서로 세운다 — 도구 중립 라우터 문서, 사실 하나당 소유 문서, 작업 유형별 skill, 구조 검사 스크립트, LLM 기록 문서. Node(mise)·Next·React 버전을 고정한다."
- **결과**: 골격 커밋 2개(workspace·Next 앱, core 주소 규약 + 테스트) 뒤에 `AGENTS.md`·`TECH_RULES.md`·`DESIGN.md`·skill 3종·`scripts/check-structure.sh` 생성.
- **판정**: 잘 됨.
- **이유**: "무엇을 만들지"보다 "어떤 순서와 경계로 만들지"를 지정해, Agent가 기능 코드보다 규약(상태 소유권, origin 기반 undo, AI 결과 비기록)을 먼저 문서로 고정했다. 이후 세션은 이 규약에서 시작한다.

## P2 — 팀 기술 스택 기준으로 스택 확정 (2026-10-02, 착수)

- **프롬프트 요지**: 목표 기술 스택(TypeScript·Next.js·React, Zustand, pnpm monorepo, Vitest, styled-components, Yjs)을 붙이고 골격에 반영하도록 지시.
- **결과**: pnpm workspace(`apps/web` + `packages/sheet-core`), Vitest를 core에, Zustand·styled-components·Yjs는 첫 사용 커밋에서 추가하도록 `TECH_RULES.md`에 고정. TanStack Query는 캐시할 서버 데이터가 없어 미채택으로 근거와 재검토 조건을 `DESIGN.md`에 기록.
- **판정**: 보완 — 스택 목록을 그대로 다 설치하지 않고, 쓰는 시점에 넣는 규칙과 미채택 근거로 바꿨다.
- **이유**: 목록을 미리 설치하면 쓰지 않는 의존성이 생기고, "왜 썼나"에 답할 수 없는 코드가 된다.

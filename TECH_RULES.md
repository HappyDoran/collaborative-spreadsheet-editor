---
title: 기술 스택과 구현 규칙
kind: rule
last_verified: 2026-10-02
---

# 기술 스택 및 구현 규칙

이 문서는 구현에 적용할 기술 규칙의 소유자다. 문서 소유권과 권위 순서는 `AGENTS.md` 문서 맵이 기준이다 — 여기 복사하지 않는다. 각 선택의 근거는 `DESIGN.md`가 소유한다.

## 1. 고정 기술 스택

| 영역 | 선택 | 버전 정본 |
| --- | --- | --- |
| 런타임 | Node 24.18.1, pnpm 10.34.6 (mise 관리) | `mise.toml`, 루트 `package.json` `packageManager` |
| 저장소 | pnpm workspace — `apps/web`, `packages/sheet-core` | `pnpm-workspace.yaml` |
| 프레임워크 | Next.js 15.5.16 App Router + Turbopack, React 19.2.8 | `apps/web/package.json` |
| 언어 | TypeScript 5 `strict` (core는 `noUncheckedIndexedAccess` 추가) | 각 패키지 `tsconfig.json` |
| 동기화 | Yjs 13.6.33 (`Y.Doc`, `Y.UndoManager`, awareness), awareness 프로토콜 y-protocols 1.0.7, 영속 y-indexeddb 9.0.12. 탭 간 전송은 BroadcastChannel 직접 연결(`apps/web/src/collab/broadcastProvider.ts`) — 브라우저 API만 | `packages/sheet-core/package.json`, `apps/web/package.json` |
| 로컬 UI 상태 | Zustand 5.0.15 | `apps/web/package.json` |
| 스타일 | styled-components 6.5.3 (SSR registry `StyledRegistry`, SWC `compiler.styledComponents`) | `apps/web/package.json`, `apps/web/next.config.ts` |
| 테스트 | Vitest 5 — `@sheet/core` 대상 | `packages/sheet-core/package.json` |
| LLM 연결 | OpenAI 직접 — AI SDK `ai` 7, `@ai-sdk/openai` 4 (Responses API). 모델은 허용 목록(`gpt-5.4-nano`·`gpt-5.4-mini` 기본·`gpt-5.4`) | `apps/web/package.json`, `packages/sheet-core/src/ai/models.ts` |

- 의존성은 그것을 처음 쓰는 코드와 같은 커밋에서 추가한다. "나중에 쓸" 의존성을 미리 넣지 않는다.
- 위 표에 없는 의존성은 표준 API·기존 의존성으로 불가능할 때만 추가하고, 추가하면 이 표와 `DESIGN.md`에 사유를 적는다.
- 미채택: TanStack Query — 서버 캐시 대상 데이터가 없다. 근거와 재검토 조건은 `DESIGN.md`.

## 2. 상태 소유권 — 절대 어기지 말 것

상태는 "누가 보는가 × 얼마나 사는가"로 소유자가 정해진다. 같은 사실을 두 곳에 두지 않는다.

| 상태 | 소유자 | 예 |
| --- | --- | --- |
| 공유 + 영속 | `Y.Doc` | 셀 값, 셀 서식 |
| 공유 + 일시 (탭이 닫히면 사라짐) | Yjs awareness | 참여자 이름·색, 선택 범위, 편집 중 셀, AI 생성·검토 중 범위(제안 값은 싣지 않음) |
| 로컬 + 일시 | Zustand store | 내 선택 앵커, 편집 초안, AI 패널 UI, 내 AI 제안의 진행 상태 |
| 탭 단위 + 새로고침 유지 | Zustand `persist` + `sessionStorage` | 내 참여자 이름·색 (`apps/web/src/stores/identityStore.ts`), 적용 전 AI 제안·대화 (`apps/web/src/stores/aiStore.ts`) |
| 브라우저 단위 + 반영구 | `localStorage` | 마지막에 쓴 이름 — 새 탭 이름 입력의 기본값일 뿐, 참여자 상태가 아니다 |

- 셀 데이터는 `Y.Doc`가 유일한 진실이다. Zustand에 셀 값을 복제하지 않는다 — React는 `Y.Doc` 구독으로 렌더한다.
- 다른 참여자에게 보여야 하는 일시 상태는 Zustand가 아니라 awareness에 둔다. awareness는 탭 종료 시 정리되어 요구사항 C6을 만족한다.

## 3. 좌표 규약

- 셀 좌표는 `{ row, col }` 0 기준. 화면 표기 A1은 `packages/sheet-core/src/address.ts`에서만 변환한다.
- 범위는 항상 `normalizeRange`로 정규화된 `{ start(좌상단), end(우하단) }`로 저장·전송한다. 드래그 방향을 그대로 저장하지 않는다.
- 셀 키 직렬화(Y.Map 키)는 core 한 곳에서만 만든다. 다른 곳에서 문자열을 조립하지 않는다.

## 4. 동기화·실행 취소 규약

- `Y.Doc` 변경은 `@sheet/core`의 연산 함수로만 한다. 연산은 `doc.transact(fn, origin)`으로 감싸고, 사용자 동작 하나 = transaction 하나 = undo 한 단계다.
- 로컬 변경 origin은 탭마다 하나의 값으로 고정하고 `Y.UndoManager`의 `trackedOrigins`에 그 값만 넣는다. 원격·영속 계층에서 들어온 update는 추적하지 않는다 — 요구사항 C7("내 변경만 되돌림").
- 여러 셀을 바꾸는 동작(붙여넣기, 범위 서식, AI 적용)은 반드시 transaction 하나로 묶는다. 다른 탭에 중간 상태가 보이지 않고 undo가 한 번에 되돌린다 — 요구사항 A5.
- 전송(BroadcastChannel)과 영속(IndexedDB)은 `apps/web/src/collab/`에만 둔다. 네트워크 동기화로 확장할 때 교체 지점이 이 폴더 하나가 되도록 한다.

## 5. AI 편집 규약

- LLM 호출은 서버 라우트(`apps/web/src/app/api/`)에서만 한다. API 키는 서버 환경 변수로만 읽고 `NEXT_PUBLIC_` 접두를 붙이지 않는다.
- 브라우저가 보낸 모델 이름은 그대로 쓰지 않는다. `resolveModel`로 허용 목록에 맞춘다.
- 클라이언트 요청은 `AbortController`로 취소 가능해야 하고, 서버 라우트는 `request.signal`을 provider 호출까지 전달해 취소 시 생성을 멈춘다.
- AI 결과는 `Y.Doc`에 바로 쓰지 않는다. 제안(원래 값 / 제안 값)은 내 탭의 초안(`sessionStorage`)으로 보관하고, 사용자가 셀 하나 또는 전부를 적용할 때 transaction 하나로 쓴다 — 요구사항 A3·A5. 다른 참여자에게는 생성·검토 중인 범위만 awareness로 알린다.
- 모델 출력은 신뢰 경계 밖의 입력이다. 셀 주소·범위·형식을 검증한 뒤에만 제안으로 받아들인다. 대상 범위 밖 셀을 바꾸는 출력은 거부한다.
- 지연·스트리밍·실패·취소는 각각 사용자에게 구분되는 상태로 보여야 한다 — 요구사항 A4·A6.

## 6. 패키지·계층 구조

배치 규칙과 허용 의존 방향은 `.codex/skills/layer-architecture/SKILL.md`, 채택 근거는 `DESIGN.md`가 소유한다. 여기서는 상위 원칙만 못박는다:

```
@sheet/core (순수 도메인: 주소·범위, 문서 스키마·연산, undo 정책, AI 제안 diff·충돌 판정)
      ▲
      │ import
apps/web/src/collab   (Y.Doc ↔ BroadcastChannel·IndexedDB·awareness, React 모름)
apps/web/src/stores   (Zustand 로컬 UI 상태)
apps/web/src/hooks    (React ↔ Y.Doc·awareness·store 바인딩)
apps/web/src/components (styled-components UI)
apps/web/src/app      (라우트, api/ 서버 라우트)
```

- core는 React·Next·브라우저 전역을 모른다. node 환경 Vitest에서 그대로 실행된다.
- UI는 `yjs`를 직접 import하지 않는다. 읽기는 hooks, 쓰기는 core 연산을 거친다.

## 7. 구현 금지 사항

각 금지에는 기술적 이유와 허용 예외를 함께 적는다 — 이유 없는 규칙은 다음 작업자가 되돌린다. 기계 검사 가능한 항목은 `scripts/check-structure.sh`가 잡는다.

| 금지 | 이유 | 허용 예외 |
| --- | --- | --- |
| core에서 `react`·`next`·`zustand`·`styled-components` import, `window`·`document`·`BroadcastChannel`·`indexedDB`·`localStorage` 사용 | core를 node에서 테스트할 수 없게 되고, 도메인 규칙이 UI·전송 계층에 묶인다 | 없음 |
| `components/`·`stores/`에서 `yjs` import | core 연산을 우회한 변경은 origin·transaction 규약을 깨 undo가 남의 변경을 되돌리거나 여러 단계로 쪼개진다 | 없음 — 타입이 필요하면 core가 재수출 |
| Zustand store에 셀 값 복제 | 진실 공급원이 둘이 되어 탭 간 표시가 어긋난다 | 없음 |
| `collab/` 밖에서 `BroadcastChannel`·`indexedDB` 사용 | 네트워크 확장 시 교체 지점이 흩어진다 | 없음 |
| transaction 없이 여러 셀 변경 | 다른 탭에 중간 상태 노출, undo 여러 단계 | 없음 |
| AI 결과를 적용 전에 `Y.Doc`에 기록 | 미확정 값이 다른 탭에 전파되고 요구사항 A3 위반 | 없음 |
| 클라이언트 코드에서 LLM provider 직접 호출, `NEXT_PUBLIC_*KEY*` 환경 변수 | API 키가 번들에 노출된다 | 없음 |
| 서버 라우트(`app/api/`)에서 `components/`·`stores/`·`collab/` import | 서버 번들에 클라이언트 전용 코드가 섞인다 | core의 순수 타입·검증 함수 |

## 8. 검증과 보고

- `README.md` 검증 절의 명령(`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm check`)을 전부 통과해야 완료다. 런타임 동작 변경은 다중 탭 수동 확인을 병행한다. 계층 선택 기준은 `.codex/skills/test-policy/SKILL.md`.
- 브라우저에서 확인하지 못한 동작은 "미검증"으로 명시하고, 가능한 범위(타입·단위 테스트·빌드)까지만 통과로 적는다.

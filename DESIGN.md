---
title: 설계 판단 근거
kind: design
last_verified: 2026-10-02
---

# 설계 판단 근거

규칙 자체는 `TECH_RULES.md`가, 배치 규칙은 `.codex/skills/layer-architecture/SKILL.md`가 소유한다. 이 문서는 "왜 그렇게 정했는가"와 "언제 다시 볼 것인가"만 적는다. 결정이 확정될 때 절을 추가한다 — 미결 결정은 `docs/spec/gap-analysis.md`에 있다.

## 1. 패키지 분리: `@sheet/core` + `@sheet/web` (pnpm workspace)

- **결정**: 시트 도메인 로직(주소·범위, 문서 연산, undo 정책, AI 제안 diff·충돌 판정)을 React·브라우저를 모르는 `packages/sheet-core`로 분리하고, Next.js 앱은 `apps/web`에 둔다.
- **이유**:
  - 이 프로젝트에서 조용히 틀리기 쉬운 로직(좌표 off-by-one, undo가 남의 변경을 되돌림, AI 결과가 범위 밖 셀을 씀)은 전부 UI와 무관한 순수 로직이다. 패키지 경계가 있으면 "core는 React·DOM을 import하지 않는다"가 관례가 아니라 구조로 강제되고, node 환경 Vitest에서 브라우저 없이 검증된다.
  - 네트워크 동기화로 확장할 때 바뀌는 곳(전송 계층)과 바뀌지 않는 곳(도메인)이 패키지 단위로 보인다.
- **검토한 대안**: 단일 Next.js 앱 안의 `src/core/` 폴더. 설정은 더 적지만 경계가 import 규칙 검사에만 의존한다. 비용 차이는 `pnpm-workspace.yaml`과 `transpilePackages` 한 줄이라 분리를 택했다.
- **비용 통제**: core는 빌드 단계 없이 TS 소스로 소비한다 (`exports: ./src/index.ts`). 패키지를 더 늘리지 않는다 — 세 번째 패키지는 두 번째 앱이나 독립 배포 단위가 생길 때만.

## 2. 상태 소유권: `Y.Doc` / awareness / Zustand 3분할

- **결정**: 공유+영속 = `Y.Doc`, 공유+일시 = awareness, 로컬+일시 = Zustand (`TECH_RULES.md` 2절).
- **이유**:
  - 셀 데이터를 Zustand와 `Y.Doc` 양쪽에 두면 동기화 코드가 생기고, 그 코드가 탭 간 불일치의 원천이 된다. 진실 공급원은 하나여야 한다.
  - 선택 범위·편집 중 셀·참여자 정보는 다른 탭에 보여야 하지만 영속되면 안 된다(C5·C6). awareness는 탭 종료 시 상태가 제거되는 수명을 이미 가진다.
  - 내 선택 앵커·입력 초안·패널 UI는 다른 탭이 알 필요가 없고 렌더 빈도가 높다. Zustand selector로 필요한 컴포넌트만 다시 그린다.
- **실행 취소를 Zustand가 아니라 `Y.UndoManager`로 하는 이유**: 스냅샷 기반 undo는 "이전 상태로 되돌리기"라서 그 사이 들어온 다른 탭의 변경까지 되돌린다(C7 위반). `Y.UndoManager`는 `trackedOrigins`로 내 transaction만 역연산하고, 원격 변경은 보존한다.

## 3. 동기화 라이브러리: Yjs

- **결정**: Yjs.
- **이유**: awareness 프로토콜과 origin 기반 `UndoManager`를 기본 제공해 C4~C7을 직접 구현하지 않아도 된다. update가 바이너리 하나라 전송 수단(BroadcastChannel ↔ WebSocket)을 바꿔도 문서 모델이 그대로다.
- **검토한 대안**: Automerge — 문서 이력 모델은 강하지만 presence와 사용자별 undo를 직접 만들어야 한다.

## 4. 미채택: TanStack Query

- **이유**: 서버에서 가져와 캐시할 데이터가 없다. 시트는 브라우저 안의 `Y.Doc`이 진실이고, AI 요청은 캐시·재검증 대상이 아닌 일회성 스트림이다. 스트림 수명주기(시작·청크·취소·실패)는 `AbortController`와 작은 상태 머신이 더 직접적이다.
- **재검토 조건**: 서버 저장 시트 목록, 사용자 설정 등 캐시·무효화가 필요한 서버 데이터가 생길 때.

## 5. 스타일: styled-components

- **이유**: 참여자 색처럼 런타임 값에 따라 바뀌는 스타일(원격 선택 테두리, 편집 중 셀 배지)을 props로 표현하고, 컴포넌트와 스타일을 한 파일에 둔다.
- **비용**: App Router에서는 SSR 스타일 수집용 registry가 필요하다. 첫 컴포넌트 커밋에서 함께 추가한다.

## 6. 버전 고정

- Next.js 15.5.16 / React 19.2.8: App Router 안정 기능만 필요하고, 메이저 신기능에 의존하지 않는다. 패치 버전까지 고정해 로컬과 배포 결과를 같게 한다.
- Node 24.18.1 (Active LTS), pnpm 10.34.6: `mise.toml`로 고정한다. 로컬 셸에 다른 Node가 있어도 저장소 기준 버전이 문서와 설정 한 곳에 있다.

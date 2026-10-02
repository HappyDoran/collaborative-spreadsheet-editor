---
name: layer-architecture
description: 이 저장소의 패키지·폴더 계층 배치 규칙. 파일을 추가·이동·리팩토링하거나 새 기능(시트 연산, 동기화, AI 흐름, UI 컴포넌트)을 만들 때 어느 패키지·폴더에 두고 무엇을 import해도 되는지 판단하는 데 사용한다.
---

# 계층 배치 규칙

폴더 경계가 곧 "무엇을 알아도 되는가"의 경계다. 채택 근거는 `DESIGN.md`, 현재 스냅샷은 `docs/architecture/folder-structure.md`. 이 skill은 안정적인 배치·의존 규칙만 소유한다.

## 계층과 의존 방향

```
app  →  components  →  hooks  →  stores · collab · ai  →  @sheet/core
```

| 위치 | 책임 | import 허용 | import 금지 |
| --- | --- | --- | --- |
| `packages/sheet-core/src/` | 순수 도메인 — 주소·범위, 문서 스키마·연산, undo 정책, AI 제안 diff·충돌 판정, AI 출력 검증 | `yjs` | `react`, `next`, `zustand`, `styled-components`, `@/…`(web), 브라우저 전역 |
| `apps/web/src/collab/` | `Y.Doc` ↔ BroadcastChannel·IndexedDB·awareness 연결, 참여자 식별 | `@sheet/core`, `yjs`, Yjs provider | `react`, `zustand`, `styled-components`, `components/`, `hooks/` |
| `apps/web/src/ai/` | AI 요청 수명주기(시작·스트림 수신·취소·실패)의 클라이언트 측 | `@sheet/core` | `react`, `yjs`, `components/` |
| `apps/web/src/stores/` | Zustand 로컬 UI 상태 | `zustand`, `@sheet/core` | `yjs`, `react-dom`, `styled-components`, `components/` |
| `apps/web/src/hooks/` | React ↔ `Y.Doc`·awareness·store 바인딩 (구독, 파생값) | 위 전부, `react`, `yjs` | `components/`, `styled-components` |
| `apps/web/src/components/` | 표시와 입력. 쓰기는 hooks가 노출한 core 연산 호출로만 | `react`, `styled-components`, `hooks/`, `stores/`, `@sheet/core` | `yjs`, `collab/` 직접 |
| `apps/web/src/app/` | 라우트·레이아웃, `api/` 서버 라우트 | 페이지: `components/`. `api/`: `@sheet/core`, LLM SDK | `api/`에서 `components/`·`stores/`·`collab/`·`hooks/` |

- 위 규칙은 `scripts/check-structure.sh`가 grep으로 검사한다. 간접 참조·의미 위반(예: hooks 안에서 transaction 없이 쓰기)은 리뷰에서 본다.

## 무엇을 어디에 두는가

| 만드는 것 | 위치 | 이름 |
| --- | --- | --- |
| 셀·범위·문서 연산 (값 쓰기, 서식, 붙여넣기) | `packages/sheet-core/src/<name>.ts` | 명사형 모듈 (`address`, `sheet`, `format`) |
| AI 제안 diff, 충돌 판정, 모델 출력 검증 | `packages/sheet-core/src/ai/` | |
| 공유 타입 (`CellAddress`, `CellRange`, 제안 타입) | 그것을 만드는 core 모듈 안 | 별도 types 파일은 여러 모듈이 공유할 때만 |
| 전송·영속 provider, awareness 상태 형식 | `apps/web/src/collab/` | |
| 로컬 UI 상태 | `apps/web/src/stores/<name>Store.ts` | `use<Name>Store` |
| React 바인딩 | `apps/web/src/hooks/use<Name>.ts` | |
| 화면 구성 요소 | `apps/web/src/components/<Name>.tsx` | PascalCase, styled 정의는 같은 파일 |
| LLM 호출 | `apps/web/src/app/api/<name>/route.ts` | |

- 폴더는 첫 파일이 생길 때 만든다. 빈 폴더·자리 파일을 두지 않는다.
- 하위 폴더는 같은 폴더 파일이 8개를 넘어 탐색이 불편해질 때만 만든다 (core의 `ai/`는 책임이 분리되어 처음부터 허용).
- 구현이 하나인 interface, 단순 위임만 하는 service·repository 계층은 만들지 않는다. 예외: 전송 계층은 네트워크 확장 설명을 위해 교체 지점을 `collab/` 한 폴더로 모으되, 추상 interface는 두 번째 구현이 생길 때 만든다.
- 파일을 옮기면 `docs/architecture/folder-structure.md`를 같은 커밋에서 갱신한다.

## 확장 조건

- 시트가 여러 개(탭·문서 목록)가 되면 `Y.Doc` 하나를 시트 단위로 나눌지 검토하고, 이 skill과 `TECH_RULES.md` 상태 소유권 표를 함께 개정한다.
- web의 순수 함수가 core 밖에서 테스트가 필요해지면, 먼저 core로 옮길 수 있는지 본다 (React·브라우저를 모르면 core 소속).

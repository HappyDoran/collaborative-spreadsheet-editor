# LLM 활용 리포트

> 작성 규칙: 사례는 발생 즉시 추가한다 (몰아 쓰기 금지). 완료 시 최종 정리.

## 1. 사용한 도구와 워크플로우

- **도구**: Claude Code (CLI). Codex도 같은 진입 문서(`AGENTS.md`)와 skill을 읽도록 구성했다. Claude Code 플러그인 ponytail(과잉 설계 억제 규칙)을 세션에 적용.
- **워크플로우**: 요구사항 문서(`docs/spec/requirements.md`)를 컨텍스트로 제공 → 사람이 스택·버전·패키지 경계를 지정 → Agent가 골격 생성 → 기능 구현 전에 Agent 작업 지원 체계(라우터·소유 문서·skill·구조 검사)를 세워 규약을 먼저 고정 → 단계(M1~M5, `docs/spec/gap-analysis.md`) 단위로 구현 위임 → 매 커밋 `pnpm test`·`typecheck`·`lint`·`check` → 다중 탭 수동 확인 결과를 피드백으로 재투입.
- **에이전트 컨텍스트 세팅**: `AGENTS.md`(라우터, `CLAUDE.md`는 symlink) + `TECH_RULES.md`(상태 소유권·좌표·origin 기반 undo·AI 결과 비기록 규약과 금지 표) + `DESIGN.md`(결정 근거) + skill 3종(`layer-architecture`, `test-policy`, `git-commit`) + `scripts/check-structure.sh`(계층 import·테스트 배치·비밀·금칙어·문서 경로 검사). 의도: LLM이 자신 있게 틀리는 영역(좌표 off-by-one, 남의 변경까지 되돌리는 undo, 상태 공급원 중복)을 세션이 바뀌어도 같은 규약으로 막고, 작성 주체를 커밋 제목 태그로 남겨 이 리포트의 근거로 삼는다. 구조는 `docs/AI_AGENT_HARNESS.md`.

## 2. 역할 구분

커밋 제목 태그(`[llm]`/`[human]`/`[llm+human]`)를 집계해 갱신한다.

| 파일/모듈 | 작성 주체 | 비고 |
|---|---|---|
| 스택·버전·패키지 경계 (`mise.toml`, 루트 `package.json`, `pnpm-workspace.yaml`) | 사람 결정 + LLM 작성 | Node 24.18.1·Next.js 15.5.16·React 19.2.8 고정, core/web 분리는 사람 지정. React는 생성기 기본값 19.1.0에서 19.2.8로 지정 |
| `apps/web` 골격 | 생성기 + LLM 정리 | create-next-app 15.5.16 출력에서 템플릿 이미지·CSS 모듈 제거, `transpilePackages` 추가 |
| `packages/sheet-core/src/address.ts`, `address.test.ts` | LLM 생성 | 0 기준 좌표·A1 변환·범위 정규화. 26진 경계(Z→AA, ZZ→AAA)와 잘못된 표기를 테스트로 고정 |
| Agent 작업 지원 체계 (`AGENTS.md`, `TECH_RULES.md`, `DESIGN.md`, skill 3종, `scripts/check-structure.sh`, `docs/`) | 사람 설계 + LLM 본문 | 사람이 이 프로젝트용으로 구축한 체계 — 도구 중립 라우터, 사실 하나당 소유 문서 하나, 작업 유형별 skill, grep 기반 구조·문서 계약 검사. 구조·소유권·상태 소유권 3분할은 사람 지정, 본문은 LLM |
| UX 기준·M1 범위 (엑셀 조작 관례, 복사·붙여넣기 포함) | 사람 결정 | 사람이 "사용자가 가장 많이 쓰는 표는 엑셀"이라는 기준과 복사·붙여넣기 포함을 결정. LLM은 키맵 표·하지 않을 것 목록·시각 토큰 초안 (`DESIGN.md` 7~10절) |
| 문서 스키마(칸별 셀 맵, `"행:열"` 키), 고정 100×26 그리드 | LLM 제안 → 사람 승인 | 객체 통째 저장과 가상화를 대안으로 비교한 브리핑 후 결정 |
| `packages/sheet-core/src/sheet.ts`, `clipboard.ts` + 테스트 | LLM 생성 | undo `captureTimeout: 0`, 붙여넣기의 단일 셀 채우기·시트 밖 잘림을 테스트로 고정. 두 `Y.Doc` 교환으로 "내 변경만 undo"와 값·서식 동시 병합 검증 |
| `apps/web/src/` (collab·stores·hooks·components) | LLM 생성 | 활성 셀 위 상시 입력칸(한글 IME), 준비·입력·편집 모드. 브라우저 시나리오 21건으로 검증하며 결함 수정 (사례 4·5) |

## 3. 이슈와 해결 과정 (LLM 오류·기각·수정 사례 포함)

### 사례 1 — `mise exec`가 Node 버전을 보장한다는 가정 (LLM 오류, 검증으로 발견)
- **무엇**: LLM이 `mise.toml`에 Node 24.18.1을 고정한 뒤 `mise exec -- pnpm test`·`build`를 실행하며 Node 24로 돈다고 가정했다. 실제로는 셸 PATH 앞쪽의 nvm Node 18이 우선해, 타입 검사·린트·빌드가 Node 18에서 "통과"로 보고됐다.
- **어떻게 알았나**: Vitest 5가 시작 단계에서 `node:util`의 `styleText` export 없음으로 실패. 빌드 통과만 봤다면 놓쳤다. `pnpm exec node -v`로 18.19.0 확인.
- **수정**: mise 설치 경로를 PATH 앞에 두고 의존성을 재설치해 Node 24.18.1에서 테스트 4건·타입·린트·빌드 재검증. `AGENTS.md` 로컬 함정과 `README.md` 실행 절에 "명령 전 `node -v` 확인"을 고정.

### 사례 2 — 작성 주체 표기를 커밋 trailer에서 제목 태그로 (LLM 제안 기각, 사람 결정)
- **무엇**: 착수 전 LLM은 역할 구분 근거로 커밋 trailer(`Authored-by: human | llm | llm+human`)를 제안했다.
- **왜 기각했나**: trailer는 `git log --oneline`에 보이지 않아 집계에 별도 포맷이 필요하고, AI 도구가 자동으로 붙이는 trailer(`Co-Authored-By` 등)와 섞여 의미가 흐려진다.
- **수정**: 제목 끝 `[llm]`/`[human]`/`[llm+human]` 태그로 표기하고 AI trailer는 금지 (`.codex/skills/git-commit/SKILL.md`).

### 사례 3 — 첫 골격 커밋이 단독으로 빌드되지 않음 (LLM 오류, 커밋 직후 발견)
- **무엇**: 첫 커밋의 `apps/web/src/app/page.tsx`가 `@sheet/core`를 import하는데, core 패키지는 다음 커밋에 들어갔다. 검증은 작업 트리 전체에서 돌려 통과했지만 커밋 단위로는 빌드가 깨진다.
- **어떻게 알았나**: 커밋 직후 `git status`에 `packages/`가 미추적으로 남은 것을 보고 stage 범위를 대조.
- **처리**: 이력 재작성은 사람 승인 사항이라 바로 다음 커밋으로 core를 추가해 HEAD 기준 정합을 맞췄다. 교훈은 `git-commit` skill 절차 1(요청 작업에 속한 파일만 stage)을 의존 관계까지 포함해 확인하는 것.

### 사례 4 — 활성 셀 입력칸이 클릭을 가로챔 (LLM 오류, 브라우저 시나리오로 발견)
- **무엇**: 한글 IME 조합을 받으려고 활성 셀 위에 실제 `<input>`을 항상 띄웠는데, 준비 상태에서도 그 입력칸이 마우스 이벤트를 받았다. 이미 선택된 셀을 더블클릭해도 편집 모드로 들어가지 않는 결함 — 셀 판별을 `data-row` 속성으로 하는데 입력칸에는 속성이 없었다.
- **어떻게 알았나**: Playwright 시나리오의 첫 클릭이 "input intercepts pointer events"로 시간 초과. 타입 검사·린트·빌드는 모두 통과한 상태였다.
- **수정**: 준비 상태에서는 입력칸에 `pointer-events: none`, 입력·편집 중에만 받는다. 재실행에서 더블클릭 편집 포함 21건 통과.

### 사례 5 — 글자 하나마다 2,600셀을 다시 그리는 구독 (LLM 자체 점검, 실행 전 수정)
- **무엇**: 첫 `Grid` 초안이 Zustand store 전체를 구독하고 렌더마다 모든 셀을 `Y.Doc`에서 다시 읽었다. 입력 중 초안이 바뀔 때마다 그리드 전체가 다시 계산되는 구조.
- **어떻게 알았나**: 상태 소유권 규칙(로컬 초안은 Zustand, 셀은 `Y.Doc`)대로 구독 범위를 대조하다가 발견.
- **수정**: 입력칸을 `ActiveInput`으로 분리해 모드·초안만 구독, 셀 목록은 문서 `version`이 바뀔 때만 다시 만들고(`useMemo`), 셀 컴포넌트는 원시값 props + `memo`.

## 4. 핵심 프롬프트 발췌

완료 시 `docs/prompts.md`에서 2~3개를 골라 옮긴다.

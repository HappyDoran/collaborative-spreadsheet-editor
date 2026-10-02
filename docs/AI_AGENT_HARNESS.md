---
title: AI Agent 작업 지원 체계
kind: design
last_verified: 2026-10-02
---

# AI Agent 작업 지원 체계

## 목적과 범위

이 문서는 이 저장소에 구현된 AI Agent 친화 문서 구조와 검증 체계를 설명한다. Agent가 과거 대화 없이 작업을 시작해 필요한 사실을 찾고, 실제 코드를 확인하고, 변경을 검증하고, 다음 세션에 근거를 남기는 운영 방식을 연결한다. Claude Code와 Codex 둘 다 같은 본문을 읽는다.

이 체계는 긴 프롬프트 하나가 아니라 다음 피드백 루프다.

```
저장소 진입 (AGENTS.md / CLAUDE.md)
  → 작업 범위와 완료 조건 확인 (docs/spec/gap-analysis.md)
  → 사실의 소유 문서 선택 (문서 맵)
  → 실제 코드·설정으로 현재 상태 확인
  → 작업 유형에 맞는 skill 적용
  → 코드·소유 문서 변경
  → pnpm test · typecheck · lint · check + 다중 탭 수동 확인
  → LLM 제안 기각·수정 사례를 LLM_REPORT.md에 즉시 기록
  → 커밋 본문에 결정 이유와 검증 증거 보존
  → 다음 세션이 갱신된 현재 사실에서 다시 시작
```

대상 독자: 과거 대화 없이 시작하는 Agent, 코드를 리뷰하는 사람, 동기화·undo·AI 규약을 건드리는 작업자.

## 도입 배경

구현의 대부분을 Agent에게 맡기면 다음 위험이 생긴다. 이 프로젝트의 코드 품질 기준(코드를 이해하고 설명할 수 있는가, 중복·복잡도를 걷어냈는가)과 정면으로 부딪히는 위험이다.

- **자신 있게 틀리는 영역**: 셀 좌표 off-by-one, 역방향 드래그 범위, `Y.UndoManager`의 origin 추적(남의 변경까지 되돌림), awareness 정리, AI 취소가 서버까지 전파되지 않음. 규약을 문서로 고정하지 않으면 세션마다 같은 실수를 반복한다.
- **상태 공급원 증식**: Agent는 편한 위치에 상태를 만든다. 셀 값이 Zustand와 `Y.Doc` 양쪽에 생기면 탭 간 불일치가 구조적으로 발생한다.
- **설명할 수 없는 코드**: 생성된 코드의 출처와 판단 근거가 남지 않으면 리뷰에서 "왜 이렇게 했는가"에 답할 수 없다.
- **검증 착시**: "빌드됨"과 "두 탭에서 동작함"은 다르다. 구분해 보고하지 않으면 미검증 동작이 완료로 기록된다.
- **문서 충돌**: 규약·명령·설계 근거·LLM 기록이 한 파일에 섞이면 일부만 갱신되어 서로 모순된다.

이를 해결하기 위한 원칙:

1. 진입점은 짧은 라우터로 유지한다.
2. 사실 하나에 소유 문서 하나.
3. 규약(`TECH_RULES.md`)과 근거(`DESIGN.md`)와 절차(skill)를 분리한다.
4. 기계적으로 판정 가능한 규칙은 스크립트로 옮긴다.
5. 구현되지 않은 문서는 만들지 않고 도입 조건만 둔다.
6. 구조적 결정의 과거 이유는 커밋 본문이, LLM 기각·수정 이력은 `LLM_REPORT.md`가, 작성 주체는 커밋 제목 태그가 소유한다.

단독 작업·원격 PR 없음이라 CI와 PR 템플릿은 아직 두지 않는다. 도입 조건은 아래 확장 조건 표에 있다.

## 권위와 사실 판정 순서

1. 실행 가능한 계약 — 소스 코드, `package.json`·`mise.toml`·`tsconfig.json`, `scripts/check-structure.sh`.
2. `TECH_RULES.md`.
3. `AGENTS.md` 문서 맵의 소유 문서.
4. `AGENTS.md`의 작업 흐름과 절대 금지.

문서가 구현과 다르면 구현이 현재 상태다. 계약을 의도적으로 바꾸는 작업은 코드와 소유 문서를 같은 커밋에서 갱신한다. 문서별 소유 사실과 갱신 트리거는 `AGENTS.md` 문서 맵이, 파일 위치는 `docs/architecture/folder-structure.md`가 소유한다 — 여기 복사하지 않는다.

## Canonical과 도구별 진입

```
Codex   → AGENTS.md → .codex/skills/<skill>/SKILL.md
Claude  → CLAUDE.md (symlink) → AGENTS.md → .claude/skills/<skill>/SKILL.md (symlink) → .codex/skills/<skill>/SKILL.md
```

복사본은 두지 않는다. `scripts/check-structure.sh`가 symlink가 정확한 대상을 가리키는지 검사한다.

## Skill별 역할

| Skill | 적용 대상 | 판단 내용 |
| --- | --- | --- |
| `layer-architecture` | 파일 추가·이동, 새 기능 | 패키지·폴더, 허용 import, 이름, 확장 조건 |
| `test-policy` | 모든 코드 변경 | 단위 테스트 필수 대상, 타입·린트·빌드·구조 검사·다중 탭 매트릭스 선택 |
| `git-commit` | 커밋 | 제목 태그, 본문 항목, 트레일러 금지 |

## 작업 흐름

1. **범위 분리.** 동작 변경 / 구조 변경 / 공동 편집×AI 정책 변경 / 문서 변경 중 무엇인지, 다중 탭 확인이 필요한지.
2. **문서 선택.** `AGENTS.md` 작업 유형별 필독 표에 따라 소유 문서만 읽는다.
3. **구현 근거 조사.** 문서보다 코드 우선.
4. **계층 결정.** `layer-architecture`로 위치를 정하고, `test-policy`로 검증 계층을 정한다.
5. **코드·문서 동시 변경.** 결정이 확정되면 `DESIGN.md`, 파일이 옮겨지면 `folder-structure.md`, 단계가 끝나면 `gap-analysis.md`, LLM 제안을 고쳤으면 `LLM_REPORT.md`.
6. **검증.** `pnpm test`·`typecheck`·`lint`·`check`, 런타임 변경 시 다중 탭 매트릭스.
7. **커밋.** `git-commit` 규칙. 검증 결과와 미검증 항목을 본문에.

## 역할 분담: 사람이 뼈대, Agent가 구현

| 사람이 소유 | Agent에 위임 |
| --- | --- |
| 상태 소유권, 계층 경계, 문서 스키마, undo·origin 정책 | 정해진 경계 안의 연산·컴포넌트·hooks 구현 |
| 공동 편집×AI 정책(X1~X3)의 선택과 이유 | 정책을 구현하는 코드, 대안 비교 브리핑 |
| 테스트 필수 대상 판정, 다중 탭 확인 | 테스트 케이스 작성, 구조 검사 실행 |
| LLM 제안의 기각·수정 판단 | 기각 사례 기록 초안 |

작성 주체는 커밋 제목의 `[llm]`/`[human]`/`[llm+human]`으로 남기고, `LLM_REPORT.md` 역할 구분 표는 이 로그에서 집계한다.

## 자동 검증 체계

`scripts/check-structure.sh` (`pnpm check`)가 검사하는 것:

| 범주 | 검사 |
| --- | --- |
| 문서 | 필수 문서 존재, 에이전트용 문서 frontmatter(`title`, `kind`, `last_verified`; 산출 문서 `README.md`·`LLM_REPORT.md` 제외), 문서 안 인라인 코드 경로(`*.ts`, `*.tsx`, `*.md`, `*.sh`, `*.json`, `*.yaml`, `*.toml`)의 실제 존재 |
| 진입점 | `CLAUDE.md → AGENTS.md` symlink, `.claude/skills/<n>/SKILL.md → .codex/skills/<n>/SKILL.md` symlink, skill frontmatter `name` 일치, 고아 symlink 없음 |
| 계층 규칙 | core: UI·프레임워크 import와 브라우저 전역 금지, web 별칭 import 금지. `components/`·`stores/`: `yjs` import 금지. `collab/`·`ai/`: React·Zustand·styled-components 금지. `collab/` 밖 `BroadcastChannel`·`indexedDB` 금지. `app/api/`: 클라이언트 계층 import 금지 |
| 테스트 배치 | 테스트 파일은 core에만, core 모듈마다 `<module>.test.ts` 존재 (진입 index·공유 types 파일 제외) |
| 비밀·개인정보 | `NEXT_PUBLIC_*KEY*`·`SECRET`·`TOKEN` 환경 변수 금지, 추적 파일에 `.env` 금지, 로컬 금칙어 목록 `.private-terms`(gitignore)의 단어가 추적 파일에 없는지 |

검사는 grep 기반이다. 간접 참조, transaction 누락 같은 의미적 위반은 잡지 못한다 — 그것은 `TECH_RULES.md` 금지 표와 리뷰가 담당한다.

## 현재 한계

- CI가 없다. 검사는 로컬에서 실행하며 커밋 전 실행은 `git-commit` skill 절차에 의존한다.
- 단위 테스트는 core만 대상이다. hooks·collab·컴포넌트는 다중 탭 수동 확인에 의존한다.
- `last_verified`는 사람이 적는 날짜이며 만료 검사는 없다.
- 문서 경로 검사는 인라인 코드의 확장자 있는 경로만 본다. 폴더 표기와 fenced code block 안은 검사하지 않는다.

## 확장 조건

| 후보 | 도입 조건 | 기대 효과 |
| --- | --- | --- |
| pre-commit hook | 구조 검사를 빼먹은 커밋이 두 번 이상 | 검사 강제 |
| CI (test + typecheck + lint + check) | 원격 저장소에서 PR 리뷰 시작 | merge 전 기계 검사 |
| Playwright 다중 탭 E2E | 수동 매트릭스가 10항목 초과 | 동기화 회귀 자동 검출 |
| ADR | 같은 결정이 두 번 이상 번복 | 대안·rollback 조건 보존 |
| 새 skill (예: 동기화 규약) | `TECH_RULES.md` 한 절이 절차를 포함할 만큼 커질 때 | 규약과 절차 분리 |

후보 도입 시 먼저 기존 소유 문서에 넣을 수 있는지 판단하고, 새 문서가 필요하면 `AGENTS.md` 문서 맵에 등록한다.

---
title: 저장소 작업 규범
kind: rule
last_verified: 2026-10-02
---

# Collaborative Sheet — 공동 편집 + AI 편집 스프레드시트

브라우저 탭 간 실시간 공동 편집(Yjs)과 LLM 편집 제안을 지원하는 웹 스프레드시트. pnpm workspace — 도메인 로직 `packages/sheet-core`(`@sheet/core`), Next.js 앱 `apps/web`(`@sheet/web`).

이 문서는 저장소 규칙의 도구 중립 진입점이다. 백과사전이 아니라 라우터다 — 규칙 본문은 아래 소유 문서에서 읽는다. `CLAUDE.md`는 이 파일의 symlink이므로 본문을 복사하지 않는다. Codex는 이 파일과 `.codex/skills/`를, Claude는 `CLAUDE.md`와 `.claude/skills/`(symlink)를 통해 같은 본문을 읽는다.

## 권위 순서 (충돌 시 위가 이긴다)

1. 실행 가능한 계약 — 소스 코드, `package.json`·`mise.toml`·`tsconfig.json` 설정, `scripts/check-structure.sh`. 문서가 코드와 다르면 코드가 현재 사실이고, 문서를 고친다.
2. `TECH_RULES.md` — 고정 스택, 상태 소유권·좌표·동기화 규약, 구현 금지 사항.
3. 아래 문서 맵의 소유 문서 — 각 사실의 단일 소유자.
4. 이 문서의 절대 금지·작업 흐름.

계약을 바꾸려면 코드와 소유 문서를 같은 커밋에서 함께 바꾼다.

## 문서 맵 (사실 하나당 소유 문서 하나)

| 사실 | 소유 문서 | 갱신을 유발하는 변경 |
| --- | --- | --- |
| 고정 스택·버전, 상태 소유권, 좌표·동기화·AI 규약, 구현 금지 | `TECH_RULES.md` | 의존성 추가·버전 변경, 규약 변경, 금지 패턴 추가 |
| 프로젝트 개요, 실행·검증 명령, 배포 절차, 네트워크 확장 설계, 주요 의사결정 요약 | `README.md` | 기능·명령·검증 절차 변경 |
| 요구사항 번호(E·C·A·X·T·D) | `docs/spec/requirements.md` | 요구사항 해석 변경 |
| 요구사항 대비 현재 상태, 보완 백로그와 우선순위, 미결 결정 | `docs/spec/gap-analysis.md` | 백로그 항목 완료, 결정 확정, 재점검 |
| 설계 판단 근거 (패키지 분리, 상태 소유권, 동기화 방식, 공동 편집×AI 정책) | `DESIGN.md` | 구조 판단 또는 정책 변경 |
| 패키지·폴더 계층 배치 규칙과 허용 의존 방향 | `.codex/skills/layer-architecture/SKILL.md` | 계층 규칙, 허용 import 변경 |
| 현재 폴더·파일 책임 스냅샷 | `docs/architecture/folder-structure.md` | 파일 추가·이동·삭제 |
| 검증 계층 (단위 테스트·타입·린트·빌드·구조 검사·다중 탭 매트릭스)과 테스트 필수 대상 | `.codex/skills/test-policy/SKILL.md` | 테스트 계층·필수 대상 변경 |
| 커밋 제목·본문·작성 주체 표기 규칙 | `.codex/skills/git-commit/SKILL.md` | 표기·본문 규칙 변경 |
| 수동 확인 시나리오 (단계·기대 결과, 자동/수동 구분)와 확인 기록(시나리오 ID별 결과) | `docs/manual-scenarios.md` | 사용자에게 보이는 동작 변경 |
| LLM 활용 기록 (도구, 역할 구분, 기각·수정 사례, 핵심 프롬프트) | `LLM_REPORT.md` | LLM 제안을 기각·수정한 즉시 |
| 프롬프트 원본 기록 (잘 된 것·실패한 것과 이유) | `docs/prompts.md` | 결과가 기대와 크게 달랐던 프롬프트, 재사용할 프롬프트 |
| AI Agent 작업 지원 체계 | `docs/AI_AGENT_HARNESS.md` | 진입점, 문서 소유권, skill, 검사 흐름 변경 |
| 구조적 결정의 사유와 검증 결과 | Git 커밋 본문 | 구조 규칙 도입, 예외 승인, 동작 변경 |

문서 추가 규칙 (이 문단이 소유):
- 같은 사실의 소유자가 위 표에 있으면 새 문서 대신 그 문서를 갱신한다.
- 새 소유 문서는 현재 코드·검증 증거로 내용을 채울 수 있을 때만 만들고, 만들면 이 표에 한 줄 추가한다. TBD 자리 문서와 빈 디렉터리는 만들지 않는다.
- 에이전트용 문서(루트 규범 문서, `docs/`)는 `title`, `kind`(`rule|design|guide|snapshot|history|spec`), `last_verified` frontmatter를 둔다. 사람이 읽는 산출 문서(`README.md`, `LLM_REPORT.md`)는 frontmatter를 두지 않는다.
- skill은 `name`, `description` frontmatter로 `.codex/skills/<name>/SKILL.md`에 두고 `.claude/skills/<name>/SKILL.md`는 symlink만 둔다.
- ADR·CI·PR 템플릿은 반복 비용이 생겼을 때 도입한다 (`docs/AI_AGENT_HARNESS.md` 확장 조건).

## 작업 유형별 필독

| 작업 | 시작 전 읽는 문서 |
| --- | --- |
| 모든 코드 변경 | `TECH_RULES.md`, `.codex/skills/test-policy/SKILL.md` |
| 파일 추가·이동, 리팩토링, 새 패키지 | `.codex/skills/layer-architecture/SKILL.md`, `docs/architecture/folder-structure.md` |
| 동기화·awareness·undo 변경 | `TECH_RULES.md` 상태 소유권·동기화 절, `DESIGN.md` |
| AI 편집 흐름 변경 | `TECH_RULES.md` AI 절, `DESIGN.md` 공동 편집×AI 정책 |
| 기능 착수·완료, 요구사항 상태 반영 | `docs/spec/requirements.md`, `docs/spec/gap-analysis.md`, `README.md` |
| 문서·Agent 체계 변경 | `docs/AI_AGENT_HARNESS.md`, 이 문서의 문서 추가 규칙 |

## 절대 금지 (이 문서가 소유)

- 검증하지 않은 결과를 통과로 보고하지 않는다. 탭 간 동기화·awareness·AI 스트리밍은 브라우저 다중 탭 확인 없이는 "미검증"이다.
- 파일·브랜치 삭제, 이력 재작성(`push --force`, `reset --hard`)은 사용자 승인 없이 하지 않는다.
- LLM 제안을 기각·수정한 사례를 몰아 쓰지 않는다 — 발생 즉시 `LLM_REPORT.md`에 추가한다.
- 커밋 메시지에 `Co-Authored-By`, `Claude-Session` 등 AI 트레일러를 넣지 않는다. 작성 주체는 제목의 `[llm]`/`[human]`/`[llm+human]` 태그로만 표기한다.
- API 키를 클라이언트 번들(`NEXT_PUBLIC_*`)이나 커밋에 넣지 않는다. 키는 서버 라우트의 환경 변수로만 읽는다.
- 배포물·저장소에 개인 식별 정보(이름, 이메일, 사진)를 넣지 않는다. 로컬 금칙어 목록 `.private-terms`(gitignore)를 `scripts/check-structure.sh`가 검사한다.
- 사용자 문구와 문서는 한국어로 쓴다. 코드 식별자·프레임워크 용어는 원문 유지.

## 명령어와 로컬 함정

실행·검증 명령의 단일 기준은 `README.md`.

- Node·pnpm 버전은 `mise.toml`이 정본이다. 셸에 nvm 등 다른 Node가 PATH 앞에 있으면 `mise exec`로도 mise 버전이 가려진다. 명령 전 `node -v`가 `mise.toml`과 같은지 확인한다 — 다르면 Vitest가 `node:util`의 `styleText` 없음으로 시작조차 못 한다.
- `@sheet/core`는 빌드 산출물 없이 TS 소스로 소비된다 (`transpilePackages`). core에 빌드 단계를 추가하지 않는다.
- 탭 간 동기화는 같은 브라우저·같은 origin에서만 성립한다. `localhost`와 `127.0.0.1`은 다른 origin이다.

## 작업 흐름

1. 시작 전에 범위를 나눈다 — 동작 변경인지, 구조 변경인지, 정책(공동 편집×AI) 변경인지, 다중 탭 확인이 필요한지.
2. 변경 범위의 소유 문서만 읽는다. 전부 읽지 않는다.
3. 코드를 바꾸는 모든 작업은 `.codex/skills/test-policy/SKILL.md`를 적용한다 — core 순수 로직은 테스트를 함께 두고, `pnpm test`·`pnpm typecheck`·`pnpm lint`·`pnpm check`를 통과시키고, 런타임 동작이 바뀌면 다중 탭 확인 결과를 `docs/manual-scenarios.md` 확인 기록에 남긴다.
4. 사실이 바뀌면 문서 맵의 소유 문서를 같은 커밋에서 갱신하고 `last_verified`를 갱신 날짜로 맞춘다.
5. 커밋은 의미 단위. 제목 끝에 작성 주체 `[llm]`/`[human]`/`[llm+human]`을 표기하고 본문에 사유와 검증을 남긴다 (`.codex/skills/git-commit/SKILL.md`).
6. 완료 보고에는 실행한 검증과 실행하지 못한 검증을 구분해 적는다.

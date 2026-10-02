# Collaborative Sheet

여러 브라우저 탭에서 같은 시트를 동시에 편집하고, AI에게 범위 편집을 제안받아 검토 후 적용하는 웹 스프레드시트.

- 상태: 저장소 골격과 개발 체계 구축 단계. 기능 진행 상황은 `docs/spec/gap-analysis.md`.
- 구조: pnpm workspace — 도메인 로직 `packages/sheet-core`, Next.js 앱 `apps/web`. 상세는 `docs/architecture/folder-structure.md`.

## 로컬 실행

필요 도구: [mise](https://mise.jdx.dev) (Node·pnpm 버전 관리).

```bash
mise install            # mise.toml의 node 24.18.1, pnpm 10.34.6 설치
node -v                 # v24.18.1 확인 — 다른 Node가 PATH 앞에 있으면 mise 버전이 가려진다
pnpm install
pnpm dev                # http://localhost:3000
```

공동 편집 확인: 같은 브라우저에서 같은 주소를 탭 여러 개로 연다. `localhost`와 `127.0.0.1`은 서로 다른 origin이라 동기화되지 않는다.

## 검증

| 명령 | 내용 |
| --- | --- |
| `pnpm test` | `@sheet/core` 단위 테스트 (Vitest) |
| `pnpm typecheck` | 전 패키지 타입 검사 |
| `pnpm lint` | ESLint (Next 규칙) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm check` | 구조·문서 계약 검사 (`scripts/check-structure.sh`) |

검증 계층과 테스트 필수 대상은 `.codex/skills/test-policy/SKILL.md`.

### 다중 탭 수동 매트릭스

런타임 동작을 바꾼 커밋은 아래 형식으로 결과를 남긴다. 시나리오는 기능이 구현될 때 추가한다.

| 시나리오 | 탭 수 | 결과 |
| --- | --- | --- |
| M1 편집: 입력·Enter/Tab 이동(Tab 후 Enter 시작 열 복귀)·F2·더블클릭 편집·Esc 취소·숫자 오른쪽 정렬 | 1 | Chromium 통과 (2026-10-02, Playwright 스크립트), Safari 미검증 |
| M1 선택·서식: Shift+방향키·드래그 범위, Cmd+B 범위 굵게, 상태 표시줄 합계 | 1 | Chromium 통과, Safari 미검증 |
| M1 클립보드: 복사·붙여넣기(값+서식), 단일 셀 → 범위 채우기, 외부 TSV(따옴표 안 탭), 잘라내기, Delete | 1 | Chromium 통과, Safari 미검증 |
| M1 실행 취소: 붙여넣기 한 번 undo, redo | 1 | Chromium 통과 |
| M1 한글: IME 조합 입력의 첫 글자 유지 | 1 | Chromium 통과 (CDP IME 조합 주입), 실제 macOS IME 미검증 |
| M1 영속: 새로고침 후 내용 유지 | 1 | Chromium 통과 |

## 개발 방식

이 저장소는 AI Agent(Claude Code, Codex)가 구현을 맡고 사람이 구조·규약·판단을 맡는 방식으로 개발한다. 진입점은 `AGENTS.md`, 체계 설명은 `docs/AI_AGENT_HARNESS.md`, 활용 기록은 `LLM_REPORT.md`.

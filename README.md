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

### 수동 매트릭스

시나리오 단계와 기대 결과는 `docs/manual-scenarios.md`가 소유한다. 여기에는 시나리오 ID별 결과만 남긴다.

| 시나리오 ID | 브라우저 | 날짜 | 결과 |
| --- | --- | --- | --- |
| M1-A1·A2·A4·A6·A10(일부), M1-B1(일부)·B2·B6, M1-C1(굵게), M1-D1·D3·D4, M1-E1·E2, M1-F1 | Chromium (Playwright 자동) | 2026-10-02 | 통과 |
| M1-G1 (입력기 조합 흉내) | Chromium (CDP IME 주입) | 2026-10-02 | 통과 — 실제 입력기 미검증 |
| 그 밖의 M1 전 항목 | Chrome, Safari | — | 미검증 |

## 개발 방식

이 저장소는 AI Agent(Claude Code, Codex)가 구현을 맡고 사람이 구조·규약·판단을 맡는 방식으로 개발한다. 진입점은 `AGENTS.md`, 체계 설명은 `docs/AI_AGENT_HARNESS.md`, 활용 기록은 `LLM_REPORT.md`.

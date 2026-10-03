# Collaborative Sheet

여러 브라우저 탭에서 같은 시트를 동시에 편집하고, AI에게 범위 편집을 제안받아 검토 후 적용하는 웹 스프레드시트.

- 상태: 편집(M1)·공동 편집(M2)·AI 편집(M3) 구현. 진행 상황은 `docs/spec/gap-analysis.md`.
- 구조: pnpm workspace — 도메인 로직 `packages/sheet-core`, Next.js 앱 `apps/web`. 상세는 `docs/architecture/folder-structure.md`.

## 로컬 실행

필요 도구: [mise](https://mise.jdx.dev) (Node·pnpm 버전 관리).

```bash
mise install            # mise.toml의 node 24.18.1, pnpm 10.34.6 설치
node -v                 # v24.18.1 확인 — 다른 Node가 PATH 앞에 있으면 mise 버전이 가려진다
pnpm install
cp apps/web/.env.example apps/web/.env.local   # OPENAI_API_KEY 채우기 (AI 편집용)
pnpm dev                # http://localhost:3000
```

AI 편집: 키는 서버에서만 읽는다(`apps/web/src/app/api/ai/route.ts`). 개발 서버는 **가짜 응답 모드**로 시작한다 — 왼쪽 위 버튼으로 실제 AI와 바꿀 수 있고, 배포본에서는 주소에 `?debug=1`을 붙였을 때만 그 버튼이 보인다. 키가 없어도 가짜 응답으로 전체 흐름을 볼 수 있다.

공동 편집 확인: 같은 브라우저에서 같은 주소를 탭 여러 개로 연다. `localhost`와 `127.0.0.1`은 서로 다른 origin이라 동기화되지 않는다.

## 검증

| 명령 | 내용 |
| --- | --- |
| `pnpm test` | `@sheet/core` 단위 테스트 (Vitest) |
| `pnpm typecheck` | 전 패키지 타입 검사 |
| `pnpm lint` | ESLint (Next 규칙) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm check` | 구조·문서 계약 검사 (`scripts/check-structure.sh`) |
| `pnpm e2e` | Playwright E2E — 실제 Chromium에서 편집·여러 탭 공동 편집·AI 편집(가짜 응답) 시나리오. dev 서버(3100번 포트)를 스스로 띄운다. 처음 한 번 `pnpm --filter @sheet/web exec playwright install chromium` |

검증 계층과 테스트 필수 대상은 `.codex/skills/test-policy/SKILL.md`.

### 수동 매트릭스

시나리오 단계와 기대 결과는 `docs/manual-scenarios.md`가 소유한다. 여기에는 시나리오 ID별 결과만 남긴다.

| 시나리오 ID | 브라우저 | 날짜 | 결과 |
| --- | --- | --- | --- |
| M1-A1·A2·A4·A6·A10(일부), M1-B1(일부)·B2·B6, M1-C1(굵게), M1-D1·D3·D4, M1-E1·E2, M1-F1 | Chromium (Playwright 자동) | 2026-10-02 | 통과 |
| M1-G1 (입력기 조합 흉내) | Chromium (CDP IME 주입) | 2026-10-02 | 통과 — 실제 입력기 미검증 |
| M1-A1·A2·A3·A6·A7·A9·A10·A11·A12·A13, M1-B1·B3·B4·B6, M1-C1·C2·C4·C5, M1-D1·D2·D3·D4, M1-E1·E2·E3·E4·E5, M1-F1·F2·F3, M1-G1·G2·G3·G4, M1-H1·H2 | Safari | 2026-10-02~03 | 통과 — `localhost:3001` 실제 브라우저 UI 확인. F2·외부 앱 항목 제외 |
| M1-A2·A3·A7·A11·A12, M1-B1·B3·B4·B6, M1-C1·C2·C4·C5, M1-D1·D2·D3·D4, M1-E1·E2·E3·E4·E5, M1-F1·F2·F3, M1-G1·G2·G3·G4, M1-H1·H2 | Chrome | 2026-10-03 | 통과 — `localhost:3001` 실제 브라우저 UI 확인 |
| M1-B5 | Safari, Chrome | 2026-10-03 | 통과 — 왼쪽 위 모서리 클릭과 셀 선택 후 ⌘A 모두 전체 선택됨. ⌘A는 사용자 직접 확인으로 정정 |
| M1-A4·A5·A8, M1-B2, M1-D5·D6·D7·D8·D9, M1-E6, M1-H3·H4 | Safari, Chrome | 2026-10-03 | 통과 — 사용자 직접 수동 확인 (재확인 순서 1~12) |
| M1-A1·A6·A9·A10·A13 | Chrome | 2026-10-03 | 통과 — 사용자 직접 수동 확인 (재확인 순서 13~17) |
| M1-C3 | `@sheet/core` Vitest | 2026-10-03 | 통과 — `pnpm test` 18/18, 혼합 서식 토글 포함 |
| `pnpm e2e` 16건 — M1-A1·A2·A4·A6·B2·C1·D1·D3·E1·F1·G1(CDP), 외부 TSV, M2-N1·N2·N3·N4·N5·N7·C1·C2·C3·C4·C5·C6·C7 (탭 단위 이름 개정 반영) | Chromium (`apps/web/e2e/`) | 2026-10-03 | 통과 (전체 3회 + 공동 편집 3회 반복) |
| M2-N1·N2·N3·N4·N5·N7 (탭 단위 이름 개정 후 재검증) | 실제 브라우저 — 사용자 직접 확인 | 2026-10-03 | 통과 |
| M2-N6·N8, M2-C5b·C6b·C8 (수동 전용) | 실제 브라우저 — 사용자 직접 확인 | 2026-10-03 | 통과 |
| `pnpm e2e` 29건 — 위 16건 + M3 13건 (가짜 응답: 전체 적용·버리기, 새로고침 유지, 다른 탭 상태, 모델 선택, 닫힌 패널) | Chromium (`apps/web/e2e/`) | 2026-10-03 | 통과 (전체 3회 + AI 3회 반복) |
| `pnpm e2e` 40건 — 위 29건 + M3.5 10건 + M1-D7(Excel·구글 시트 서식 붙여넣기) (우클릭 메뉴: 선택 규칙·복사/잘라내기/붙여넣기·값만/서식만 붙여넣기·서식 지우기·서식 체크·AI로 편집·Shift+F10·편집 중·권한 거절·화면 끝) | Chromium (`apps/web/e2e/`) | 2026-10-03 | 통과 (전체 2회 + 메뉴 3회 반복) |
| M3.5-2(메뉴 붙여넣기 권한 허용), M3.5-9(Safari 붙여넣기 말풍선), M3.5-10(Mac Ctrl+클릭·두 손가락 클릭), M3.5-11(휠 스크롤로 닫힘), M3.5-14(키보드 ⌘⇧V 값만 붙여넣기) | 실제 브라우저 — 사용자 직접 확인 | 2026-10-03 | 통과 |
| 모델 3종 실제 호출 (nano 2.6초, mini, 5.4 4.1초 — 같은 계산 정답) | 서버 라우트 직접 | 2026-10-03 | 통과 |
| M3 실제 AI: 범위 부가세 계산 → 미리보기 → 적용 → 실행 취소 한 번 | Chromium (Playwright, 실제 OpenAI 1회) | 2026-10-03 | 통과 |
| M3-3·5·8·17 (전체 적용·버리기 개정 후), M3-19(실제 AI 모델 3종 비교), M3-20(애니메이션·좁은 화면·동작 줄이기) | 실제 브라우저 — 사용자 직접 확인 | 2026-10-03 | 통과 |
| M3-7(서식 요청 안내), M3-11(오프라인 실패), M3-12(채팅창 한글 조합 중 Enter), M3-14(새로고침·탭 닫기) | 실제 브라우저 — 사용자 직접 확인 | 2026-10-03 | 통과 |
| M3-15(좁은 화면에서 패널 ✕로 닫기) | 실제 브라우저 — 사용자 직접 확인 | 2026-10-03 | 통과 |
| M3-16(배포본 디버깅 버튼 — 배포 후) | 배포본 | — | 미검증 |

## 개발 방식

이 저장소는 AI Agent(Claude Code, Codex)가 구현을 맡고 사람이 구조·규약·판단을 맡는 방식으로 개발한다. 진입점은 `AGENTS.md`, 체계 설명은 `docs/AI_AGENT_HARNESS.md`, 활용 기록은 `LLM_REPORT.md`.

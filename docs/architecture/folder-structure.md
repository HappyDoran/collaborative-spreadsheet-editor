---
title: 현재 폴더 구성 스냅샷
kind: snapshot
last_verified: 2026-10-05
---

# 현재 폴더 구성 스냅샷

파일을 추가·이동·삭제하면 이 문서를 같은 커밋에서 갱신한다. 배치 규칙 자체는 `.codex/skills/layer-architecture/SKILL.md`가 소유하고, 규칙 위반은 `scripts/check-structure.sh`가 잡는다. 이 문서는 "지금 무엇이 어디 있는가"만 적는다.

```
.
├── AGENTS.md                         # 도구 중립 진입점, 문서 맵, 작업 흐름
├── CLAUDE.md -> AGENTS.md            # Claude용 진입 symlink
├── TECH_RULES.md                     # 스택·버전, 상태 소유권, 좌표·동기화·AI 규약, 금지
├── DESIGN.md                         # 설계 판단 근거
├── README.md                         # 배포·체험 순서, 결정과 이유, 네트워크 확장, 실행·검증 명령
├── LLM_REPORT.md                     # LLM 활용 리포트
├── mise.toml                         # node·pnpm 버전 정본
├── .vercelignore                     # Vercel CLI 배포 업로드 제외 (로컬 비밀·금칙어·테스트 산출물)
├── package.json                      # 루트 스크립트 (dev·test·typecheck·lint·build·check)
├── pnpm-workspace.yaml               # apps/*, packages/*
├── docs/
│   ├── AI_AGENT_HARNESS.md           # Agent 작업 지원 체계 설명
│   ├── prompts.md                    # 프롬프트 원본 기록
│   ├── manual-scenarios.md           # 수동 확인 시나리오 (ID·단계·기대 결과)
│   ├── architecture/folder-structure.md
│   └── spec/
│       ├── requirements.md           # 요구사항 번호 (T·E·C·A·X·D)
│       └── gap-analysis.md           # 현재 상태, 미결 결정, 백로그
├── .codex/skills/                    # canonical skill (Codex 진입)
│   ├── layer-architecture/SKILL.md
│   ├── test-policy/SKILL.md
│   └── git-commit/SKILL.md
├── .claude/skills/<name>/SKILL.md -> ../../../.codex/skills/<name>/SKILL.md
├── scripts/check-structure.sh        # 구조·문서·비밀·금칙어 계약 검사
├── packages/sheet-core/              # @sheet/core — 순수 도메인, node Vitest
│   └── src/
│       ├── index.ts                  # 공개 API 재수출
│       ├── address.ts                # 0 기준 좌표 ↔ A1, 열 라벨, 범위 정규화
│       ├── address.test.ts           # 26진 경계, 잘못된 표기, 역방향 범위
│       ├── sheet.ts                  # 문서 스키마(필드별 최상위 맵), 값·서식·지우기·서식 지우기·붙여넣기(전부·값만·서식만) 연산, UndoManager 정책
│       ├── sheet.test.ts             # 빈 셀 정리, 서식 토글, 붙여넣기 채우기·잘림, undo 단위, 두 탭 undo·동시 병합(빈 칸 포함)
│       ├── merge.ts                  # 셀 병합: 읽기(겹침 정리), 병합·해제, 선택 넓히기, 병합을 건너뛰는 이동, 병합째 붙여넣기
│       ├── merge.test.ts             # 값 지우기·undo 한 단계, 흡수·해제, 두 탭 동시 병합, 잘못된 항목, 이동·선택, 붙여넣기, colspan HTML
│       ├── clipboard.ts              # TSV 직렬화·파싱(따옴표 규칙), 서식·병합(colspan·rowspan) HTML 표 생성
│       ├── clipboard.test.ts         # CRLF, 따옴표 안 탭·줄바꿈, HTML 이스케이프
│       ├── number.ts                 # 셀 글자 → 숫자 (정렬·상태 표시줄 합계 공용)
│       ├── number.test.ts            # 쉼표·퍼센트·부호, 글자로 볼 표기
│       ├── participants.ts           # 10색 팔레트, 빈 색 고르기, 이름 정규화·첫 글자, awareness 상태 타입
│       ├── participants.test.ts      # 빈 색만 고르기, 이름 공백·길이, 한글·이모지 첫 글자
│       └── ai/
│           ├── types.ts              # 서버·브라우저 공용 계약: 대상, 모델 출력 항목, NDJSON 이벤트, 오류 코드, 제안
│           ├── proposal.ts           # 모델이 보낸 셀 판정(주소·대상·변화 없음), 원래 값이 바뀐 제안, 대상 겹침(X3)
│           ├── proposal.test.ts
│           ├── context.ts            # AI에게 보낼 시트 내용(값 있는 셀만, 대상 먼저, 600셀 상한), 이전 대화 검증·축약(최근 6턴)
│           ├── context.test.ts
│           ├── models.ts             # 고를 수 있는 모델 목록·기본 모델, 목록 밖 이름을 기본으로(resolveModel)
│           └── models.test.ts
└── apps/web/                         # @sheet/web — Next.js 15.5 App Router
    ├── next.config.ts                # transpilePackages: @sheet/core, styled-components SWC
    ├── playwright.config.ts          # E2E: Chromium, 3100번 포트 dev 서버, 테스트마다 새 컨텍스트
    ├── e2e/
    │   ├── sheet.ts                  # 공용 조작 (시트 열기·이름 지정·셀·이름 상자·아바타)
    │   ├── warmup.ts                 # globalSetup — 테스트 전 페이지·AI 라우트를 불러 dev 서버 첫 컴파일을 끝냄
    │   ├── editing.spec.ts           # M1 편집·선택·서식·클립보드(엑셀·시트·문서 HTML)·undo·한글·저장·머리글·긴 글 넘침 15건
    │   ├── merge.spec.ts             # M1-I 셀 병합: 확인·가운데·undo, 이동·선택·해제, 복사·붙여넣기, 다른 탭·넘침 4건
    │   ├── collaboration.spec.ts     # M2 탭별 이름·새로고침 유지·합류·실시간·동시 편집·목록·원격 표시·탭 종료·undo 범위·놓친 변경 따라잡기·가려진 탭 깜박임·편집 중 원격 변경·새 탭 링크 13건
    │   ├── collabAi.spec.ts          # M4 두 탭 × AI: 바뀐 칸 건너뛰기·요청 순간 기준·전부 바뀜·겹침 경고 5건
    │   ├── contextMenu.spec.ts       # M3.5 우클릭 메뉴 10건
    │   └── ai.spec.ts                # M3 대상·스트리밍·적용·한 번 undo·중지·버리기·빈 결과·제외·실패·원래 값 바뀜·⌘K·위치 보기·새로고침 유지·다른 탭 상태·모델 선택·닫힌 패널·다시 시도 범위·플랫폼 오류·서버 범위 검증 16건 (가짜 응답)
    └── src/
        ├── app/
        │   ├── layout.tsx            # StyledRegistry로 감쌈
        │   ├── page.tsx              # SheetApp
        │   ├── globals.css           # 시각 토큰(DESIGN.md 10절, AI 형광펜), Pretendard(시스템 한글 글꼴 대체)
        │   └── api/ai/
        │       ├── route.ts          # OpenAI 호출(streamText + Output.array) → NDJSON, 오류 코드 분류, 크기 상한
        │       ├── prompt.ts         # 모델 지시문, 요청 프롬프트 조립
        │       └── mock.ts           # 가짜 응답(#slow #hold #gate·#release #empty #outside #quota #invalid)
        ├── ai/streamAiEdit.ts        # NDJSON 스트림 읽기, 20초 무응답, 중지
        ├── collab/
        │   ├── sheetSession.ts       # Y.Doc + awareness + IndexedDB 영속 + 탭 간 연결, 탭별 로컬 origin
        │   └── broadcastProvider.ts  # BroadcastChannel: 문서·awareness update, 합류 인사, 탭 종료 시 제거, 다시 보일 때 맞추기, 다른 탭 방송에 답해 갱신
        ├── stores/
        │   ├── selectionStore.ts     # 셀 포인터·범위, 준비/입력/편집 모드, 초안, Tab 시작 열, 복사 표시
        │   ├── identityStore.ts      # 이름·색(탭 단위 sessionStorage), 마지막 이름(localStorage, 새 탭 기본값)
        │   ├── statusStore.ts        # 상태 표시줄에 잠깐 띄우는 안내
        │   └── aiStore.ts            # AI 패널·대상 설정·진행 상태·제안·대화 (sessionStorage — 새로고침 유지), 가짜 응답 모드
        ├── hooks/
        │   ├── useSheet.ts           # 세션 수명, UndoManager, 문서 변경 구독(version), 시트 연산 묶음
        │   ├── useSheetCommands.ts   # 엑셀 키맵·확정·취소·복사/잘라내기/붙여넣기(키보드·메뉴), 내용 지우기, 클립보드 HTML 표 읽기
        │   ├── shortcut.ts           # 단축키 표기(⌘ / Ctrl) — 툴바·메뉴·안내 문구가 같이 쓴다
        │   ├── clipboardHtml.ts      # 클립보드 → 붙여넣을 셀 격자: 값은 탭 구분 텍스트, 서식은 HTML(엑셀 클래스·시트 style·b/i/u), 병합(colspan·rowspan)
        │   ├── useIdentity.ts        # 저장된 이름·색을 마운트 후 읽기
        │   ├── usePresence.ts        # 내 상태 알리기(이름·색·선택·편집 중·AI 생성/검토 범위), 색 고르기, 참여자 목록
        │   └── useAiEdit.ts          # 보내기·셀 판정·적용·버리기·중지, 대상 범위 결정, 이탈 중 끊긴 요청 무시
        └── components/
            ├── SheetApp.tsx          # 화면 골격(디버깅 버튼·제목·참여자·툴바·값 편집줄·그리드+AI 패널·상태 표시줄), ⌘K, 내 색을 --accent로
            ├── Grid.tsx              # 100×26 그리드(행 높이 자동 맞춤, 긴 글 넘침, 병합 칸), 선택·복사 테두리, 활성 셀 입력칸(textarea, 글 길이만큼 확장), 우클릭 메뉴 열기
            ├── gridGeometry.ts       # 열 너비·줄 높이 상수, 줄 수 → 행 높이, 범위 → 그리드 칸 영역
            ├── RemoteCursors.tsx     # 다른 참여자 선택·포인터·이름표·입력 중, AI 생성·검토 중 범위(점선·이름표)
            ├── ParticipantMenu.tsx   # 아바타 묶음, 접속자 목록, 이름 바꾸기·지우기
            ├── NameDialog.tsx        # 탭별 이름 지정 (마지막 이름 미리 채움)
            ├── AiPanel.tsx           # AI 패널: 대화(빈 패널 예시)·진행·미리보기(제안 수·위치 보기·적용/버리기)·실패 문구, 열고 닫기 애니메이션
            ├── AiComposer.tsx        # AI 패널 아래쪽 — 겹침 경고(X3), 대상 전환, 지시 입력·모델·보내기
            ├── ContextMenu.tsx       # 엑셀식 우클릭 메뉴 (키보드 이동, 화면 끝 뒤집기, 바깥 클릭·휠로 닫기)
            ├── ProposalLayer.tsx     # 시트 위 AI 제안 (형광펜, 원래 값 취소선, 원래 값 바뀜)
            ├── Toolbar.tsx           # 실행 취소·다시 실행, 굵게·기울임·밑줄, 병합, AI 편집 버튼
            ├── FormulaBar.tsx        # 이름 상자 + 값 편집줄 + 활성 셀의 AI 제안
            ├── StatusBar.tsx         # 준비·입력·편집 표시, 잠깐 안내, 합계·평균·개수
            └── StyledRegistry.tsx    # styled-components SSR 수집
```

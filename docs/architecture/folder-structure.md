---
title: 현재 폴더 구성 스냅샷
kind: snapshot
last_verified: 2026-10-02
---

# 현재 폴더 구성 스냅샷

파일을 추가·이동·삭제하면 이 문서를 같은 커밋에서 갱신한다. 배치 규칙 자체는 `.codex/skills/layer-architecture/SKILL.md`가 소유하고, 규칙 위반은 `scripts/check-structure.sh`가 잡는다. 이 문서는 "지금 무엇이 어디 있는가"만 적는다.

```
.
├── AGENTS.md                         # 도구 중립 진입점, 문서 맵, 작업 흐름
├── CLAUDE.md -> AGENTS.md            # Claude용 진입 symlink
├── TECH_RULES.md                     # 스택·버전, 상태 소유권, 좌표·동기화·AI 규약, 금지
├── DESIGN.md                         # 설계 판단 근거
├── README.md                         # 실행·검증 명령, 다중 탭 매트릭스
├── LLM_REPORT.md                     # LLM 활용 리포트
├── mise.toml                         # node·pnpm 버전 정본
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
│       ├── sheet.ts                  # 문서 스키마(칸별 셀 맵), 값·서식·지우기·붙여넣기 연산, UndoManager 정책
│       ├── sheet.test.ts             # 빈 셀 정리, 서식 토글, 붙여넣기 채우기·잘림, undo 단위, 두 탭 undo·동시 병합
│       ├── clipboard.ts              # TSV 직렬화·파싱(따옴표 규칙), 서식 HTML 표 생성
│       ├── clipboard.test.ts         # CRLF, 따옴표 안 탭·줄바꿈, HTML 이스케이프
│       ├── participants.ts           # 10색 팔레트, 빈 색 고르기, 이름 정규화·첫 글자, 동명이인 번호, awareness 상태 타입
│       └── participants.test.ts      # 빈 색만 고르기, 이름 공백·길이, 한글·이모지 첫 글자, 합류 순서 번호
└── apps/web/                         # @sheet/web — Next.js 15.5 App Router
    ├── next.config.ts                # transpilePackages: @sheet/core, styled-components SWC
    ├── playwright.config.ts          # E2E: Chromium, 3100번 포트 dev 서버, 테스트마다 새 컨텍스트
    ├── e2e/
    │   ├── sheet.ts                  # 공용 조작 (시트 열기·이름 지정·셀·이름 상자·아바타)
    │   ├── editing.spec.ts           # M1 편집·선택·서식·클립보드·undo·한글·저장 7건
    │   └── collaboration.spec.ts     # M2 이름 흐름·합류·실시간·동시 편집·목록·원격 표시·탭 종료·undo 범위 8건
    └── src/
        ├── app/
        │   ├── layout.tsx            # StyledRegistry로 감쌈
        │   ├── page.tsx              # SheetApp
        │   └── globals.css           # 시각 토큰(DESIGN.md 10절), 시스템 한글 글꼴
        ├── collab/
        │   ├── sheetSession.ts       # Y.Doc + awareness + IndexedDB 영속 + 탭 간 연결, 탭별 로컬 origin
        │   └── broadcastProvider.ts  # BroadcastChannel: 문서·awareness update, 합류 인사, 탭 종료 시 제거
        ├── stores/
        │   ├── selectionStore.ts     # 셀 포인터·범위, 준비/입력/편집 모드, 초안, Tab 시작 열, 복사 표시
        │   └── identityStore.ts      # 이름(localStorage)·색(sessionStorage), 탭 간 이름 동기화
        ├── hooks/
        │   ├── useSheet.ts           # 세션 수명, UndoManager, 문서 변경 구독(version), 시트 연산 묶음
        │   ├── useSheetCommands.ts   # 엑셀 키맵·확정·취소·복사/잘라내기/붙여넣기, 클립보드 HTML 표 읽기
        │   ├── useIdentity.ts        # 저장된 이름·색을 마운트 후 읽기
        │   └── usePresence.ts        # 내 상태 알리기(이름·색·선택·편집 중), 색 고르기, 참여자 목록
        └── components/
            ├── SheetApp.tsx          # 화면 골격(제목·참여자·툴바·값 편집줄·그리드·상태 표시줄), 내 색을 --accent로
            ├── Grid.tsx              # 고정 100×26 그리드, 선택·복사 테두리, 활성 셀 입력칸
            ├── gridGeometry.ts       # 셀 크기 상수, 범위 → 화면 좌표
            ├── RemoteCursors.tsx     # 다른 참여자 선택·포인터·이름표·입력 중 표시
            ├── ParticipantMenu.tsx   # 아바타 묶음, 접속자 목록, 이름 바꾸기·지우기
            ├── NameDialog.tsx        # 첫 접속 이름 지정
            ├── Toolbar.tsx           # 실행 취소·다시 실행, 굵게·기울임·밑줄
            ├── FormulaBar.tsx        # 이름 상자 + 값 편집줄
            ├── StatusBar.tsx         # 준비·입력·편집 표시, 합계·평균·개수
            └── StyledRegistry.tsx    # styled-components SSR 수집
```

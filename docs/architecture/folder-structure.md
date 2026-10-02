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
│       └── clipboard.test.ts         # CRLF, 따옴표 안 탭·줄바꿈, HTML 이스케이프
└── apps/web/                         # @sheet/web — Next.js 15.5 App Router
    ├── next.config.ts                # transpilePackages: @sheet/core, styled-components SWC
    └── src/
        ├── app/
        │   ├── layout.tsx            # StyledRegistry로 감쌈
        │   ├── page.tsx              # SheetApp
        │   └── globals.css           # 시각 토큰(DESIGN.md 10절), 시스템 한글 글꼴
        ├── collab/sheetSession.ts    # Y.Doc + IndexedDB 영속, 탭별 로컬 origin
        ├── stores/selectionStore.ts  # 셀 포인터·범위, 준비/입력/편집 모드, 초안, Tab 시작 열, 복사 표시
        ├── hooks/
        │   ├── useSheet.ts           # 세션 수명, UndoManager, 문서 변경 구독(version), 시트 연산 묶음
        │   └── useSheetCommands.ts   # 엑셀 키맵·확정·취소·복사/잘라내기/붙여넣기, 클립보드 HTML 표 읽기
        └── components/
            ├── SheetApp.tsx          # 화면 골격(제목·툴바·값 편집줄·그리드·상태 표시줄)
            ├── Grid.tsx              # 고정 100×26 그리드, 선택·복사 테두리, 활성 셀 입력칸
            ├── Toolbar.tsx           # 실행 취소·다시 실행, 굵게·기울임·밑줄
            ├── FormulaBar.tsx        # 이름 상자 + 값 편집줄
            ├── StatusBar.tsx         # 준비·입력·편집 표시, 합계·평균·개수
            └── StyledRegistry.tsx    # styled-components SSR 수집
```

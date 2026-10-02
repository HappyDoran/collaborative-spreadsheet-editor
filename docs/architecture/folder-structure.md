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
    ├── next.config.ts                # transpilePackages: @sheet/core
    └── src/app/
        ├── layout.tsx
        ├── page.tsx                  # 자리 화면 (M1에서 그리드로 교체)
        └── globals.css
```

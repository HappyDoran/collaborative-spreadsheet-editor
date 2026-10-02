#!/usr/bin/env bash
# 구조·문서·비밀 계약 검사. 규칙 본문: .codex/skills/layer-architecture/SKILL.md, docs/AI_AGENT_HARNESS.md
# grep 기반 — 간접 참조·의미 위반(transaction 누락 등)은 잡지 못한다.
set -uo pipefail
cd "$(dirname "$0")/.."
CORE=packages/sheet-core/src
WEB=apps/web/src
ERRS=$(mktemp)
trap 'rm -f "$ERRS"' EXIT
err() { echo "✗ $1"; echo x >>"$ERRS"; }

# 1. 필수 문서
for f in AGENTS.md TECH_RULES.md README.md DESIGN.md LLM_REPORT.md \
         docs/AI_AGENT_HARNESS.md docs/prompts.md docs/manual-scenarios.md docs/architecture/folder-structure.md \
         docs/spec/requirements.md docs/spec/gap-analysis.md; do
  [ -f "$f" ] || err "필수 문서 없음: $f"
done

# 2. frontmatter (루트 *.md + docs/**/*.md): title, kind, last_verified. 산출 문서(README, LLM_REPORT)는 제외.
while IFS= read -r f; do
  case "$f" in ./README.md|./LLM_REPORT.md) continue;; esac
  head -1 "$f" | grep -q '^---$' || { err "frontmatter 없음: $f"; continue; }
  fm=$(sed -n '2,/^---$/p' "$f")
  grep -q '^title: .' <<<"$fm" || err "frontmatter title 없음: $f"
  grep -qE '^kind: (rule|design|guide|snapshot|history|spec)$' <<<"$fm" || err "frontmatter kind 잘못됨: $f"
  grep -qE '^last_verified: [0-9]{4}-[0-9]{2}-[0-9]{2}$' <<<"$fm" || err "frontmatter last_verified 잘못됨: $f"
done < <(find . -maxdepth 1 -name '*.md' -type f; find docs -name '*.md' -type f)

# 3. canonical 진입 symlink
[ "$(readlink CLAUDE.md)" = "AGENTS.md" ] || err "CLAUDE.md는 AGENTS.md symlink여야 함"
for d in .codex/skills/*/; do
  n=$(basename "$d")
  [ -f "$d/SKILL.md" ] || { err "skill 파일 없음: $d/SKILL.md"; continue; }
  grep -q "^name: $n$" "$d/SKILL.md" || err "skill name 불일치: $d/SKILL.md"
  grep -q '^description: .' "$d/SKILL.md" || err "skill description 없음: $d/SKILL.md"
  [ "$(readlink ".claude/skills/$n/SKILL.md")" = "../../../.codex/skills/$n/SKILL.md" ] \
    || err "symlink 없음/잘못됨: .claude/skills/$n/SKILL.md"
done
for d in .claude/skills/*/; do
  n=$(basename "$d")
  [ -f ".codex/skills/$n/SKILL.md" ] || err "canonical 없는 skill: $d"
done

# 4. 계층 규칙. 대상 폴더가 아직 없으면 건너뛴다.
check_absent() { # dir pattern message
  [ -d "$1" ] || return 0
  grep -rlE --include='*.ts' --include='*.tsx' "$2" "$1" | while read -r f; do err "$3: $f"; done
}
IMPORT="from ['\"]"
check_absent "$CORE"              "$IMPORT(react|react-dom|next|zustand|styled-components)(/|['\"])" "core에서 UI·프레임워크 import"
check_absent "$CORE"              "$IMPORT@/"                                                     "core가 web 참조"
check_absent "$CORE"              '\b(window|document|localStorage|sessionStorage|indexedDB|BroadcastChannel)\b' "core에서 브라우저 전역 사용"
check_absent "$WEB/components"    "$IMPORT(yjs|y-[a-z-]+)['\"]"                                    "components에서 yjs 직접 import"
check_absent "$WEB/components"    "$IMPORT@/collab"                                               "components가 collab 직접 참조"
check_absent "$WEB/stores"        "$IMPORT(yjs|y-[a-z-]+)['\"]"                                    "store에서 yjs import"
check_absent "$WEB/collab"        "$IMPORT(react|zustand|styled-components)(/|['\"])"              "collab에서 React·Zustand·스타일 import"
check_absent "$WEB/ai"            "$IMPORT(react|zustand|styled-components|yjs)(/|['\"])"          "ai에서 React·Zustand·스타일·yjs import"
check_absent "$WEB/app/api"       "$IMPORT@/(components|stores|collab|hooks)"                      "서버 라우트가 클라이언트 계층 참조"
# 전송·영속 API는 collab/ 안에서만
[ -d "$WEB" ] && grep -rlE --include='*.ts' --include='*.tsx' '\b(BroadcastChannel|indexedDB)\b' "$WEB" \
  | grep -v "^$WEB/collab/" | while read -r f; do err "collab 밖에서 전송·영속 API 사용: $f"; done

# 5. 테스트 배치: 테스트는 core에만, core 모듈마다 <module>.test.ts
find apps -name '*.test.ts*' -not -path '*/node_modules/*' | while read -r f; do err "단위 테스트는 core에만 둔다: $f"; done
find . -name '*.spec.ts' -not -path '*/node_modules/*' -not -path './apps/web/e2e/*' | while read -r f; do err "E2E는 apps/web/e2e/에만 둔다: $f"; done
find "$CORE" -name '*.ts' -not -name '*.test.ts' -not -name 'index.ts' -not -name 'types.ts' | while read -r f; do
  [ -f "${f%.ts}.test.ts" ] || err "core 모듈 테스트 없음: ${f%.ts}.test.ts"
done

# 6. 비밀·개인정보
git grep --untracked -I -lE 'NEXT_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN)' -- '*.ts' '*.tsx' '*.js' '*.mjs' '.env.example' \
  | while read -r f; do err "클라이언트 노출 비밀 환경 변수: $f"; done
git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$' | while read -r f; do err ".env 파일 추적 금지: $f"; done
if [ -f .private-terms ]; then
  while IFS= read -r term; do
    case "$term" in ''|\#*) continue;; esac
    git grep --untracked -I -i -l -F -e "$term" | while read -r f; do err "금칙어 포함 (.private-terms): $f"; done
  done < .private-terms
fi

# 7. 문서 인라인 경로 존재 검사 (fenced block 밖, 확장자 있는 경로만). 저장소 루트 또는 basename 기준.
while IFS= read -r f; do
  awk '/^```/{c=!c} !c' "$f" | grep -oE '`[A-Za-z0-9_./-]+\.(ts|tsx|md|sh|json|yaml|toml)`' | tr -d '`' | sort -u \
  | while read -r p; do
      if [[ "$p" == */* ]]; then [ -e "$p" ] || err "$f 가 없는 경로 참조: $p"
      else [ -n "$(find . -name "$p" -not -path '*/node_modules/*' -not -path './.git/*' -not -path '*/.next/*' | head -1)" ] \
        || err "$f 가 없는 파일 참조: $p"; fi
    done
done < <(find . -name '*.md' -type f -not -path './.git/*' -not -path '*/node_modules/*' -not -path './.claude/*')

if [ -s "$ERRS" ]; then echo "구조 검사 실패"; exit 1; fi
echo "✓ 구조 검사 통과"

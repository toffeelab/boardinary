#!/bin/bash
# init-harness.sh — Claude Code harness 초기화 스크립트
# Usage:
#   sh scripts/init-harness.sh            # interactive (default)
#   sh scripts/init-harness.sh --defaults # all modules + default values, no prompts
#   sh scripts/init-harness.sh --check-update # version comparison + file diff
set -euo pipefail

VERSION="1.0.0"

# ============================================================
# Colors
# ============================================================
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  BOLD='\033[1m'
  DIM='\033[2m'
  NC='\033[0m'
else
  GREEN='' YELLOW='' RED='' BOLD='' DIM='' NC=''
fi

# ============================================================
# Helpers
# ============================================================
info()    { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()    { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
error()   { printf "${RED}✗${NC} %s\n" "$1" >&2; }
die()     { error "$1"; exit 1; }
header()  { printf "\n${BOLD}%s${NC}\n" "$1"; }
dim()     { printf "${DIM}%s${NC}" "$1"; }

# ============================================================
# Path detection
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(pwd)"
CONFIG_FILE="$PROJECT_DIR/.claude/.harness-config"

# ============================================================
# Parse arguments
# ============================================================
MODE="interactive"
for arg in "$@"; do
  case "$arg" in
    --defaults)     MODE="defaults" ;;
    --check-update) MODE="check-update" ;;
    --help|-h)
      cat <<'USAGE'
Usage: sh scripts/init-harness.sh [OPTIONS]

Options:
  (none)          Interactive mode — prompts for each module and value
  --defaults      Install all modules with default values, no prompts
  --check-update  Compare installed version with script version, show diffs
  -h, --help      Show this help message
USAGE
      exit 0
      ;;
    *) die "Unknown option: $arg" ;;
  esac
done

# ============================================================
# Pre-checks
# ============================================================
pre_checks() {
  if ! command -v jq &>/dev/null; then
    die "jq is required but not installed. Install: brew install jq (macOS) / apt install jq (Linux)"
  fi

  if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    die "Not inside a git repository. Please run this from a git project root."
  fi
}

# ============================================================
# Key-value store (bash 3.x compatible, using temp file)
# ============================================================
KV_FILE=""
kv_init() {
  KV_FILE=$(mktemp "${TMPDIR:-/tmp}/harness-kv.XXXXXX")
  trap 'rm -f "$KV_FILE" "$KV_FILE.prev"' EXIT
}

kv_set() {
  local key="$1" value="$2"
  # Remove existing key then append
  if [ -f "$KV_FILE" ]; then
    grep -v "^${key}=" "$KV_FILE" > "$KV_FILE.tmp" 2>/dev/null || true
    mv "$KV_FILE.tmp" "$KV_FILE"
  fi
  echo "${key}=${value}" >> "$KV_FILE"
}

kv_get() {
  local key="$1"
  if [ -f "$KV_FILE" ]; then
    grep "^${key}=" "$KV_FILE" 2>/dev/null | tail -1 | sed "s|^${key}=||"
  fi
}

# Previous values store (from .harness-config)
PREV_FILE=""
prev_init() {
  PREV_FILE=$(mktemp "${TMPDIR:-/tmp}/harness-prev.XXXXXX")
  trap 'rm -f "$KV_FILE" "$KV_FILE.tmp" "$PREV_FILE"' EXIT
}

prev_set() {
  echo "${1}=${2}" >> "$PREV_FILE"
}

prev_get() {
  local key="$1"
  if [ -f "$PREV_FILE" ]; then
    grep "^${key}=" "$PREV_FILE" 2>/dev/null | tail -1 | sed "s|^${key}=||"
  fi
}

# ============================================================
# Load previous config (if exists)
# ============================================================
load_previous_config() {
  if [ -f "$CONFIG_FILE" ]; then
    while IFS='=' read -r key value; do
      # Skip comments and empty lines
      case "$key" in
        \#*|"") continue ;;
      esac
      key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      [ -z "$key" ] && continue
      prev_set "$key" "$value"
    done < "$CONFIG_FILE"
    info "이전 설정을 로드했습니다: $CONFIG_FILE"
  fi
}

# ============================================================
# Default values
# ============================================================
get_hardcoded_default() {
  case "$1" in
    MAIN_BRANCH)      echo "main" ;;
    DEVELOP_BRANCH)   echo "develop" ;;
    PACKAGE_MANAGER)  echo "pnpm" ;;
    LINT_EXTENSIONS)  echo '"ts" "tsx" "js" "jsx"' ;;
    REVIEW_MODEL)     echo "sonnet" ;;
    REVIEW_LANGUAGE)  echo "Korean" ;;
    LINT_CMD)         echo "pnpm lint" ;;
    BUILD_CMD)        echo "pnpm build" ;;
    TEST_CMD)         echo "pnpm test" ;;
    E2E_CMD)          echo "pnpm test:e2e" ;;
    TYPE_CHECK_CMD)   echo "pnpm check-types" ;;
    BRANCH_PATTERN)   echo "feature/*" ;;
    RETENTION_DAYS)   echo "90" ;;
    PROJECT_NAME)     echo "My Project" ;;
    *)                echo "" ;;
  esac
}

# Get effective default (previous value > hardcoded default)
get_default() {
  local key="$1"
  local prev
  prev=$(prev_get "$key")
  if [ -n "$prev" ]; then
    echo "$prev"
  else
    get_hardcoded_default "$key"
  fi
}

# ============================================================
# Input validation
# ============================================================
validate_input() {
  local value="$1"
  local name="$2"

  # Allow empty (will use default)
  [ -z "$value" ] && return 0

  # Only allow safe characters
  if ! echo "$value" | grep -qE '^[a-zA-Z0-9._/ *":*-]+$'; then
    warn "입력에 허용되지 않는 문자가 포함되어 있습니다. 허용: [a-zA-Z0-9._/ -]"
    return 1
  fi

  # Warn on sensitive keywords
  local lower_value
  lower_value=$(echo "$value" | tr '[:upper:]' '[:lower:]')
  for keyword in token secret key password; do
    if echo "$lower_value" | grep -q "$keyword"; then
      warn "입력에 민감한 키워드('$keyword')가 포함되어 있습니다. 확인해주세요."
      break
    fi
  done

  return 0
}

# Prompt for a value (interactive mode only)
prompt_value() {
  local name="$1"
  local description="$2"
  local default
  default=$(get_default "$name")

  while true; do
    printf "  %s [${DIM}%s${NC}]: " "$description" "$default"
    dim "(잘 모르겠으면 Enter -- 기본값 사용)"
    printf "\n  > "
    read -r input
    if [ -z "$input" ]; then
      kv_set "$name" "$default"
      return
    fi
    if validate_input "$input" "$name"; then
      kv_set "$name" "$input"
      return
    fi
    warn "다시 입력해주세요."
  done
}

# ============================================================
# Module selection
# ============================================================
# Module flags
MOD_HOOKS=true
MOD_WORKFLOWS=true
MOD_WF_REVIEW=true
MOD_WF_CI=true
MOD_WF_CLEANUP=true
MOD_SCRIPTS=true
MOD_MEMORY=true

prompt_yn() {
  local prompt="$1"
  local default="${2:-Y}"
  if [ "$MODE" = "defaults" ]; then
    return 0  # all yes in defaults mode
  fi
  local hint
  if [ "$default" = "Y" ]; then
    hint="Y/n"
  else
    hint="y/N"
  fi
  printf "%s [%s] " "$prompt" "$hint"
  read -r answer
  answer="${answer:-$default}"
  case "$answer" in
    [Yy]*) return 0 ;;
    *) return 1 ;;
  esac
}

select_modules() {
  header "모듈 선택"
  echo ""

  if ! prompt_yn "[1/4] Claude Code Hooks -- AI가 위험한 명령을 실행하기 전에 자동 차단"; then
    MOD_HOOKS=false
  fi

  if prompt_yn "[2/4] CI/CD Workflows -- PR 자동 코드리뷰 + 빌드/테스트 파이프라인"; then
    if [ "$MODE" = "interactive" ]; then
      if ! prompt_yn "  ├── claude-review.yml -- AI가 PR을 자동 리뷰"; then
        MOD_WF_REVIEW=false
      fi
      if ! prompt_yn "  ├── ci.yml -- lint/타입체크/빌드/테스트 자동화"; then
        MOD_WF_CI=false
      fi
      if ! prompt_yn "  └── cleanup-branches.yml -- 머지된 브랜치 주간 자동 정리"; then
        MOD_WF_CLEANUP=false
      fi
    fi
  else
    MOD_WORKFLOWS=false
    MOD_WF_REVIEW=false
    MOD_WF_CI=false
    MOD_WF_CLEANUP=false
  fi

  if ! prompt_yn "[3/4] Scripts -- 개발 환경 상태 확인 + 문서 무결성 검사"; then
    MOD_SCRIPTS=false
  fi

  if ! prompt_yn "[4/4] Memory -- Claude의 대화 간 기억 저장 구조"; then
    MOD_MEMORY=false
  fi
}

# ============================================================
# Collect placeholders needed by selected modules
# ============================================================
collect_placeholders() {
  header "설정 값 입력"
  echo ""

  # Determine which placeholders are needed (using a flat list)
  NEED_PROJECT_NAME=false
  NEED_MAIN_BRANCH=false
  NEED_DEVELOP_BRANCH=false
  NEED_PACKAGE_MANAGER=false
  NEED_LINT_EXTENSIONS=false
  NEED_REVIEW_MODEL=false
  NEED_REVIEW_LANGUAGE=false
  NEED_LINT_CMD=false
  NEED_BUILD_CMD=false
  NEED_TEST_CMD=false
  NEED_E2E_CMD=false
  NEED_TYPE_CHECK_CMD=false
  NEED_BRANCH_PATTERN=false
  NEED_RETENTION_DAYS=false

  # Hooks need: MAIN_BRANCH, DEVELOP_BRANCH, PACKAGE_MANAGER, LINT_EXTENSIONS
  if [ "$MOD_HOOKS" = true ]; then
    NEED_MAIN_BRANCH=true
    NEED_DEVELOP_BRANCH=true
    NEED_PACKAGE_MANAGER=true
    NEED_LINT_EXTENSIONS=true
  fi

  # claude-review.yml needs: REVIEW_MODEL, REVIEW_LANGUAGE, DEVELOP_BRANCH
  if [ "$MOD_WF_REVIEW" = true ]; then
    NEED_REVIEW_MODEL=true
    NEED_REVIEW_LANGUAGE=true
    NEED_DEVELOP_BRANCH=true
  fi

  # ci.yml needs: LINT_CMD, BUILD_CMD, TEST_CMD, E2E_CMD, TYPE_CHECK_CMD
  if [ "$MOD_WF_CI" = true ]; then
    NEED_LINT_CMD=true
    NEED_BUILD_CMD=true
    NEED_TEST_CMD=true
    NEED_E2E_CMD=true
    NEED_TYPE_CHECK_CMD=true
  fi

  # cleanup-branches.yml needs: BRANCH_PATTERN, RETENTION_DAYS
  if [ "$MOD_WF_CLEANUP" = true ]; then
    NEED_BRANCH_PATTERN=true
    NEED_RETENTION_DAYS=true
  fi

  # Memory needs: PROJECT_NAME
  if [ "$MOD_MEMORY" = true ]; then
    NEED_PROJECT_NAME=true
  fi

  if [ "$MODE" = "defaults" ]; then
    # Use defaults for all needed placeholders
    for key in PROJECT_NAME MAIN_BRANCH DEVELOP_BRANCH PACKAGE_MANAGER LINT_EXTENSIONS \
               REVIEW_MODEL REVIEW_LANGUAGE LINT_CMD BUILD_CMD TEST_CMD E2E_CMD \
               TYPE_CHECK_CMD BRANCH_PATTERN RETENTION_DAYS; do
      local need_var="NEED_${key}"
      eval "local need_val=\$$need_var"
      if [ "$need_val" = true ]; then
        kv_set "$key" "$(get_default "$key")"
      fi
    done
    return
  fi

  # Interactive: prompt for each needed placeholder
  [ "$NEED_PROJECT_NAME" = true ]     && prompt_value "PROJECT_NAME"     "프로젝트 이름"
  [ "$NEED_MAIN_BRANCH" = true ]      && prompt_value "MAIN_BRANCH"      "메인 브랜치"
  [ "$NEED_DEVELOP_BRANCH" = true ]   && prompt_value "DEVELOP_BRANCH"   "개발 브랜치"
  [ "$NEED_PACKAGE_MANAGER" = true ]  && prompt_value "PACKAGE_MANAGER"  "패키지 매니저"
  [ "$NEED_LINT_EXTENSIONS" = true ]  && prompt_value "LINT_EXTENSIONS"  "린트 대상 확장자"
  [ "$NEED_REVIEW_MODEL" = true ]     && prompt_value "REVIEW_MODEL"     "리뷰 AI 모델"
  [ "$NEED_REVIEW_LANGUAGE" = true ]  && prompt_value "REVIEW_LANGUAGE"  "리뷰 언어"
  [ "$NEED_LINT_CMD" = true ]         && prompt_value "LINT_CMD"         "린트 명령어"
  [ "$NEED_BUILD_CMD" = true ]        && prompt_value "BUILD_CMD"        "빌드 명령어"
  [ "$NEED_TEST_CMD" = true ]         && prompt_value "TEST_CMD"         "테스트 명령어"
  [ "$NEED_E2E_CMD" = true ]          && prompt_value "E2E_CMD"          "E2E 테스트 명령어"
  [ "$NEED_TYPE_CHECK_CMD" = true ]   && prompt_value "TYPE_CHECK_CMD"   "타입체크 명령어"
  [ "$NEED_BRANCH_PATTERN" = true ]   && prompt_value "BRANCH_PATTERN"   "정리 대상 브랜치 패턴"
  [ "$NEED_RETENTION_DAYS" = true ]   && prompt_value "RETENTION_DAYS"   "브랜치 보존 일수"
}

# ============================================================
# File installation helpers
# ============================================================

# All placeholder keys for iteration
ALL_KEYS="PROJECT_NAME MAIN_BRANCH DEVELOP_BRANCH PACKAGE_MANAGER LINT_EXTENSIONS REVIEW_MODEL REVIEW_LANGUAGE LINT_CMD BUILD_CMD TEST_CMD E2E_CMD TYPE_CHECK_CMD BRANCH_PATTERN RETENTION_DAYS"

# Substitute placeholders in a file using | as sed delimiter
# Reads from file $1, writes to file $2
substitute_file() {
  local src="$1"
  local dest="$2"

  cp "$src" "$dest"
  for key in $ALL_KEYS; do
    local value
    value=$(kv_get "$key")
    if [ -n "$value" ]; then
      sed -i.bak "s|{{${key}}}|${value}|g" "$dest"
    fi
  done
  rm -f "${dest}.bak"
}

# Substitute placeholders in a string (via temp files)
substitute_string() {
  local input="$1"
  local tmpf
  tmpf=$(mktemp "${TMPDIR:-/tmp}/harness-sub.XXXXXX")
  echo "$input" > "$tmpf"
  for key in $ALL_KEYS; do
    local value
    value=$(kv_get "$key")
    if [ -n "$value" ]; then
      sed -i.bak "s|{{${key}}}|${value}|g" "$tmpf"
    fi
  done
  cat "$tmpf"
  rm -f "$tmpf" "${tmpf}.bak"
}

# Process a .template file: substitute placeholders, write without .template extension
install_template_file() {
  local src="$1"     # source template file (absolute)
  local dest="$2"    # destination file (absolute, without .template)

  local dest_dir
  dest_dir=$(dirname "$dest")
  mkdir -p "$dest_dir"

  # Create substituted content in temp file
  local tmpf
  tmpf=$(mktemp "${TMPDIR:-/tmp}/harness-tpl.XXXXXX")
  substitute_file "$src" "$tmpf"

  # Check for conflicts
  if [ -f "$dest" ]; then
    handle_template_conflict "$dest" "$tmpf"
  else
    cp "$tmpf" "$dest"
    info "생성: $dest"
  fi
  rm -f "$tmpf"
}

# Install a non-template file with in-place placeholder substitution
install_file() {
  local src="$1"
  local dest="$2"

  local dest_dir
  dest_dir=$(dirname "$dest")
  mkdir -p "$dest_dir"

  local tmpf
  tmpf=$(mktemp "${TMPDIR:-/tmp}/harness-inst.XXXXXX")
  substitute_file "$src" "$tmpf"

  if [ -f "$dest" ]; then
    handle_file_conflict "$dest" "$tmpf" "$(basename "$(dirname "$dest")")/$(basename "$dest")"
  else
    cp "$tmpf" "$dest"
    info "생성: $dest"
  fi
  rm -f "$tmpf"
}

# Handle conflict for settings.json specifically (field-level merge)
merge_settings_json() {
  local dest="$1"
  local new_file="$2"

  # Merge permissions.allow: union of arrays
  local merged_allow
  merged_allow=$(jq -s '
    [.[0].permissions.allow // [], .[1].permissions.allow // []]
    | add | unique
  ' "$dest" "$new_file")

  # Merge permissions.deny: union of arrays
  local merged_deny
  merged_deny=$(jq -s '
    [.[0].permissions.deny // [], .[1].permissions.deny // []]
    | add | unique
  ' "$dest" "$new_file")

  # Merge hooks: merge by script path within each hook type
  local merged
  merged=$(jq -s --argjson allow "$merged_allow" --argjson deny "$merged_deny" '
    def merge_hook_arrays(a; b):
      (a // []) as $existing |
      (b // []) as $new |
      ($existing | map(.hooks[0]) ) as $existing_scripts |
      $existing + [$new[] | select(.hooks[0] as $s | $existing_scripts | index($s) | not)];

    .[0] as $old | .[1] as $new |
    $old * {
      permissions: {
        allow: $allow,
        deny: $deny
      },
      hooks: {
        PreToolUse: merge_hook_arrays($old.hooks.PreToolUse; $new.hooks.PreToolUse),
        PostToolUse: merge_hook_arrays($old.hooks.PostToolUse; $new.hooks.PostToolUse)
      }
    }
  ' "$dest" "$new_file")

  echo "$merged" | jq '.' > "$dest"
  info "병합: $dest (기존 설정 유지 + 새 항목 추가)"
}

# Handle conflict for template files (settings.json gets special merge)
handle_template_conflict() {
  local dest="$1"
  local new_file="$2"

  local bname
  bname=$(basename "$dest")

  if [ "$bname" = "settings.json" ]; then
    merge_settings_json "$dest" "$new_file"
    return
  fi

  # For other template files, show diff and prompt
  handle_file_conflict "$dest" "$new_file" "$bname"
}

# Handle conflict for regular files (hooks, workflows)
# $1=dest, $2=new content file, $3=display name
handle_file_conflict() {
  local dest="$1"
  local new_file="$2"
  local display_name="${3:-$(basename "$dest")}"

  if [ "$MODE" = "defaults" ]; then
    # In defaults mode, overwrite silently
    cp "$new_file" "$dest"
    info "덮어쓰기: $dest"
    return
  fi

  # Check if files are identical
  if diff -q "$dest" "$new_file" &>/dev/null; then
    dim "  변경 없음: $display_name"
    printf "\n"
    return
  fi

  echo ""
  warn "파일이 이미 존재합니다: $display_name"
  diff "$dest" "$new_file" || true
  echo ""

  while true; do
    printf "  [O]verwrite / [S]kip / [B]ackup? "
    read -r choice
    case "$choice" in
      [Oo]*)
        cp "$new_file" "$dest"
        info "덮어쓰기: $dest"
        return
        ;;
      [Ss]*)
        warn "건너뜀: $dest"
        return
        ;;
      [Bb]*)
        local backup="${dest}.backup.$(date +%Y%m%d%H%M%S)"
        cp "$dest" "$backup"
        cp "$new_file" "$dest"
        info "백업: $backup"
        info "덮어쓰기: $dest"
        return
        ;;
      *)
        warn "O, S, B 중 선택해주세요."
        ;;
    esac
  done
}

# ============================================================
# Install modules
# ============================================================
INSTALLED_HOOKS=0
INSTALLED_WORKFLOWS=0
INSTALLED_SCRIPTS=0

install_hooks() {
  [ "$MOD_HOOKS" = true ] || return 0

  header "Hooks 설치"

  # Install hook library
  install_file \
    "$TEMPLATE_DIR/.claude/hooks/_lib/common.sh" \
    "$PROJECT_DIR/.claude/hooks/_lib/common.sh"

  # Install hook scripts (with placeholder substitution)
  install_file \
    "$TEMPLATE_DIR/.claude/hooks/PreToolUse/block-dangerous-commands.sh" \
    "$PROJECT_DIR/.claude/hooks/PreToolUse/block-dangerous-commands.sh"

  install_file \
    "$TEMPLATE_DIR/.claude/hooks/PreToolUse/warn-main-branch-edit.sh" \
    "$PROJECT_DIR/.claude/hooks/PreToolUse/warn-main-branch-edit.sh"

  install_file \
    "$TEMPLATE_DIR/.claude/hooks/PostToolUse/auto-lint-on-write.sh" \
    "$PROJECT_DIR/.claude/hooks/PostToolUse/auto-lint-on-write.sh"

  INSTALLED_HOOKS=3

  # Install settings.json (template file)
  install_template_file \
    "$TEMPLATE_DIR/.claude/settings.json.template" \
    "$PROJECT_DIR/.claude/settings.json"
}

install_workflows() {
  [ "$MOD_WORKFLOWS" = true ] || return 0

  header "CI/CD Workflows 설치"

  mkdir -p "$PROJECT_DIR/.github/workflows"

  if [ "$MOD_WF_REVIEW" = true ]; then
    install_file \
      "$TEMPLATE_DIR/.github/workflows/claude-review.yml" \
      "$PROJECT_DIR/.github/workflows/claude-review.yml"
    INSTALLED_WORKFLOWS=$((INSTALLED_WORKFLOWS + 1))
  fi

  if [ "$MOD_WF_CI" = true ]; then
    install_file \
      "$TEMPLATE_DIR/.github/workflows/ci.yml" \
      "$PROJECT_DIR/.github/workflows/ci.yml"
    INSTALLED_WORKFLOWS=$((INSTALLED_WORKFLOWS + 1))
  fi

  if [ "$MOD_WF_CLEANUP" = true ]; then
    install_file \
      "$TEMPLATE_DIR/.github/workflows/cleanup-branches.yml" \
      "$PROJECT_DIR/.github/workflows/cleanup-branches.yml"
    INSTALLED_WORKFLOWS=$((INSTALLED_WORKFLOWS + 1))
  fi
}

install_scripts() {
  [ "$MOD_SCRIPTS" = true ] || return 0

  header "Scripts 설치"

  mkdir -p "$PROJECT_DIR/scripts"

  # Copy the init-harness.sh itself for future updates
  install_file \
    "$SCRIPT_DIR/init-harness.sh" \
    "$PROJECT_DIR/scripts/init-harness.sh"

  INSTALLED_SCRIPTS=1

  # Copy any other scripts from template (if they exist in the future)
  for script in "$TEMPLATE_DIR/scripts/"*.sh; do
    [ -f "$script" ] || continue
    local bname
    bname=$(basename "$script")
    [ "$bname" = "init-harness.sh" ] && continue  # already copied
    install_file "$script" "$PROJECT_DIR/scripts/$bname"
    INSTALLED_SCRIPTS=$((INSTALLED_SCRIPTS + 1))
  done
}

install_memory() {
  [ "$MOD_MEMORY" = true ] || return 0

  header "Memory 구조 설치"

  # Detect Claude projects path
  local claude_projects_dir="$HOME/.claude/projects"

  if [ ! -d "$claude_projects_dir" ]; then
    mkdir -p "$claude_projects_dir"
  fi

  # Claude uses a hashed directory name based on the project path
  # The format is: path with / replaced by -
  local project_path_hash
  project_path_hash=$(echo "$PROJECT_DIR" | sed 's|^/||; s|/|-|g')
  local memory_dir="$claude_projects_dir/-${project_path_hash}"

  mkdir -p "$memory_dir/memory"

  # Create MEMORY.md if it doesn't exist
  local proj_name
  proj_name=$(kv_get "PROJECT_NAME")
  proj_name="${proj_name:-My Project}"

  if [ ! -f "$memory_dir/memory/MEMORY.md" ]; then
    cat > "$memory_dir/memory/MEMORY.md" <<MEMEOF
# ${proj_name} Memory

## Project Info
<!-- Claude가 대화 간 기억할 정보를 여기에 기록합니다 -->
MEMEOF
    info "생성: $memory_dir/memory/MEMORY.md"
  else
    warn "건너뜀: $memory_dir/memory/MEMORY.md (이미 존재)"
  fi
}

install_claude_md() {
  # CLAUDE.md is always skipped if it exists (protect user content)
  local dest="$PROJECT_DIR/CLAUDE.md"

  if [ -f "$dest" ]; then
    warn "건너뜀: CLAUDE.md (사용자 콘텐츠 보호)"
    return
  fi

  install_template_file \
    "$TEMPLATE_DIR/CLAUDE.md.template" \
    "$dest"
}

# ============================================================
# Post-processing
# ============================================================
post_process() {
  header "후처리"

  # chmod +x all .sh files
  find "$PROJECT_DIR/.claude/hooks" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true
  find "$PROJECT_DIR/scripts" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true
  info "스크립트 실행 권한 설정 완료"

  # Add to .gitignore
  local gitignore="$PROJECT_DIR/.gitignore"
  local added=false

  for entry in ".claude/settings.local.json" ".claude/.harness-config"; do
    if [ -f "$gitignore" ]; then
      if ! grep -qF "$entry" "$gitignore"; then
        echo "$entry" >> "$gitignore"
        added=true
      fi
    else
      echo "$entry" >> "$gitignore"
      added=true
    fi
  done

  if [ "$added" = true ]; then
    info ".gitignore에 항목 추가 완료"
  fi

  # Save .harness-config
  mkdir -p "$(dirname "$CONFIG_FILE")"
  {
    echo "# Claude Code Harness Config"
    echo "# Generated by init-harness.sh v${VERSION} on $(date +%Y-%m-%d)"
    echo "VERSION=${VERSION}"
    echo "MOD_HOOKS=${MOD_HOOKS}"
    echo "MOD_WORKFLOWS=${MOD_WORKFLOWS}"
    echo "MOD_WF_REVIEW=${MOD_WF_REVIEW}"
    echo "MOD_WF_CI=${MOD_WF_CI}"
    echo "MOD_WF_CLEANUP=${MOD_WF_CLEANUP}"
    echo "MOD_SCRIPTS=${MOD_SCRIPTS}"
    echo "MOD_MEMORY=${MOD_MEMORY}"
    for key in $ALL_KEYS; do
      local value
      value=$(kv_get "$key")
      if [ -n "$value" ]; then
        echo "${key}=${value}"
      fi
    done
  } > "$CONFIG_FILE"
  info "설정 저장: $CONFIG_FILE"
}

# ============================================================
# Completion message
# ============================================================
print_completion() {
  local main_br
  main_br=$(kv_get "MAIN_BRANCH")
  main_br="${main_br:-main}"
  local dev_br
  dev_br=$(kv_get "DEVELOP_BRANCH")
  dev_br="${dev_br:-develop}"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "${GREEN}${BOLD}✓ 설치 완료!${NC}\n"
  echo ""
  echo "설치된 구성요소:"

  if [ "$MOD_HOOKS" = true ]; then
    printf "  ${GREEN}✓${NC} Claude Code Hooks (${INSTALLED_HOOKS}개)\n"
    echo "    - 위험 명령 차단 (git push --force, rm -rf 등)"
    echo "    - 보호 브랜치 편집 차단 (${main_br}, ${dev_br})"
    echo "    - 파일 저장 후 자동 lint"
  fi

  if [ "$MOD_WORKFLOWS" = true ] && [ "$INSTALLED_WORKFLOWS" -gt 0 ]; then
    printf "  ${GREEN}✓${NC} CI/CD Workflows (${INSTALLED_WORKFLOWS}개)\n"
    [ "$MOD_WF_REVIEW" = true ]  && echo "    - claude-review.yml (AI PR 자동 리뷰)"
    [ "$MOD_WF_CI" = true ]      && echo "    - ci.yml (lint/타입체크/빌드/테스트)"
    [ "$MOD_WF_CLEANUP" = true ] && echo "    - cleanup-branches.yml (브랜치 자동 정리)"
  fi

  if [ "$MOD_SCRIPTS" = true ]; then
    printf "  ${GREEN}✓${NC} Scripts (${INSTALLED_SCRIPTS}개)\n"
  fi

  if [ "$MOD_MEMORY" = true ]; then
    printf "  ${GREEN}✓${NC} Memory\n"
  fi

  echo ""
  printf "${BOLD}테스트해보기:${NC}\n"
  echo "  Claude Code에서 \"git push --force origin main\"을 시도하면"
  echo "  \"BLOCKED: ...\" 메시지가 표시되어야 합니다."
  echo ""
  printf "${BOLD}다음 단계:${NC}\n"
  echo "  1. CLAUDE.md를 프로젝트에 맞게 작성하세요"
  echo "  2. GitHub Settings -> Secrets에 CLAUDE_CODE_OAUTH_TOKEN을 추가하세요"
  echo "  3. 설정을 git에 커밋하세요: git add .claude/ .github/ scripts/ && git commit"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ============================================================
# --check-update mode
# ============================================================
check_update() {
  header "업데이트 확인 (v${VERSION})"

  if [ ! -f "$CONFIG_FILE" ]; then
    die "설치된 harness를 찾을 수 없습니다. 먼저 init-harness.sh를 실행하세요."
  fi

  # Load installed version
  local installed_version=""
  installed_version=$(prev_get "VERSION")

  echo ""
  echo "설치된 버전: ${installed_version:-unknown}"
  echo "스크립트 버전: ${VERSION}"
  echo ""

  if [ "$installed_version" = "$VERSION" ]; then
    info "최신 버전입니다."
  else
    warn "버전이 다릅니다."
  fi

  # Compare each file
  header "파일 상태"

  local has_changes=false

  # Files to check
  for relpath in \
    ".claude/hooks/_lib/common.sh" \
    ".claude/hooks/PreToolUse/block-dangerous-commands.sh" \
    ".claude/hooks/PreToolUse/warn-main-branch-edit.sh" \
    ".claude/hooks/PostToolUse/auto-lint-on-write.sh" \
    ".github/workflows/claude-review.yml" \
    ".github/workflows/ci.yml" \
    ".github/workflows/cleanup-branches.yml" \
    ".claude/settings.json"; do

    local installed="$PROJECT_DIR/$relpath"
    local template="$TEMPLATE_DIR/$relpath"

    # Check for .template variant
    if [ ! -f "$template" ] && [ -f "${template}.template" ]; then
      template="${template}.template"
    fi

    if [ ! -f "$template" ]; then
      continue
    fi

    if [ ! -f "$installed" ]; then
      printf "  ${GREEN}[NEW]${NC} %s\n" "$relpath"
      has_changes=true
    elif ! diff -q "$installed" "$template" &>/dev/null; then
      printf "  ${YELLOW}[MOD]${NC} %s\n" "$relpath"
      has_changes=true
    else
      printf "  ${DIM}[---]${NC} %s\n" "$relpath"
    fi
  done

  echo ""

  if [ "$has_changes" = true ]; then
    if prompt_yn "업데이트를 적용하시겠습니까?"; then
      # Restore module flags from config
      for key in MOD_HOOKS MOD_WORKFLOWS MOD_WF_REVIEW MOD_WF_CI MOD_WF_CLEANUP MOD_SCRIPTS MOD_MEMORY; do
        local pval
        pval=$(prev_get "$key")
        if [ -n "$pval" ]; then
          eval "$key=$pval"
        fi
      done
      # Restore values from config
      for key in $ALL_KEYS; do
        local pval
        pval=$(prev_get "$key")
        if [ -n "$pval" ]; then
          kv_set "$key" "$pval"
        fi
      done
      install_hooks
      install_workflows
      install_scripts
      install_memory
      post_process
      info "업데이트 적용 완료!"
    else
      info "업데이트를 건너뛰었습니다."
    fi
  else
    info "모든 파일이 최신 상태입니다."
  fi
}

# ============================================================
# Main
# ============================================================
main() {
  echo ""
  printf "${BOLD}Claude Code Harness v${VERSION}${NC}\n"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  pre_checks

  # Initialize key-value stores
  kv_init
  prev_init

  if [ "$MODE" = "check-update" ]; then
    load_previous_config
    check_update
    exit 0
  fi

  load_previous_config
  select_modules
  collect_placeholders

  # Install selected modules
  install_hooks
  install_workflows
  install_scripts
  install_memory
  install_claude_md

  # Post-processing
  post_process
  print_completion
}

main

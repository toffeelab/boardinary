# 개발 도구 및 MCP 서버 가이드

## Serena MCP — 심볼릭 코드 탐색/편집

코드베이스 탐색 및 편집 시 Serena의 심볼릭 도구를 우선 활용한다.

### 탐색 (점진적 확인)

1. `get_symbols_overview` → 파일의 심볼 목록 확인
2. `find_symbol`(name_path + `include_body=True`) → 필요한 심볼만 읽기
3. 파일 전체 읽기보다 심볼 단위 읽기를 우선 — 컨텍스트 효율화

### 편집

- **심볼 단위 수정**: `replace_symbol_body` — 함수/클래스 전체 교체
- **부분 수정**: `replace_content` — 정규식 지원, 몇 줄만 변경할 때
- **삽입**: `insert_before_symbol` / `insert_after_symbol`

### 참조 추적

- `find_referencing_symbols`로 변경 영향 범위 파악 후 편집
- 변경이 backward-compatible하지 않으면 모든 참조도 함께 수정

### 검색

- 심볼명 불확실 시 `search_for_pattern`으로 후보 탐색 → 심볼릭 도구로 진입

### 메모리

- 프로젝트 진행 상황, 작업 컨텍스트를 `write_memory`로 `.serena/memories/`에 저장
- 다른 PC에서 `read_memory`로 복원 가능

## Chrome DevTools MCP — 브라우저 자동화

UI 검증 및 E2E 테스트 시 사용.

- `take_screenshot` — 현재 페이지 스크린샷
- `navigate_page` — 페이지 이동
- `click` / `fill` — 인터랙션 테스트
- `list_console_messages` — 콘솔 에러 확인
- `lighthouse_audit` — 성능/접근성 감사

## context7 MCP — 라이브러리 문서 조회

기술 문서가 필요할 때 실시간으로 최신 문서를 조회:

1. `resolve-library-id` — 라이브러리 ID 확인 (예: "next.js", "drizzle-orm")
2. `query-docs` — 특정 토픽 문서 조회

자주 사용하는 라이브러리의 캐싱된 참조는 `docs/references/` 참조.

## shadcn-studio MCP — UI 컴포넌트

shadcn/ui 컴포넌트 탐색 및 추가:

- `get-component-content` — 컴포넌트 소스 코드 확인
- `get_add_command_for_components` — 설치 명령어 생성
- `get-create-instructions` / `get-refine-instructions` — 컴포넌트 생성/수정 가이드

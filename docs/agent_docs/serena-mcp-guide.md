# Serena MCP 활용 가이드

코드베이스 탐색 및 편집 시 Serena의 심볼릭 도구를 우선 활용한다.

## 탐색 (점진적 확인)

1. `get_symbols_overview` → 파일의 심볼 목록 확인
2. `find_symbol`(name_path + `include_body=True`) → 필요한 심볼만 읽기
3. 파일 전체 읽기보다 심볼 단위 읽기를 우선 — 컨텍스트 효율화

## 편집

- **심볼 단위 수정**: `replace_symbol_body` — 함수/클래스 전체 교체
- **부분 수정**: `replace_content` — 정규식 지원, 몇 줄만 변경할 때
- **삽입**: `insert_before_symbol` / `insert_after_symbol`

## 참조 추적

- `find_referencing_symbols`로 변경 영향 범위 파악 후 편집
- 변경이 backward-compatible하지 않으면 모든 참조도 함께 수정

## 검색

- 심볼명 불확실 시 `search_for_pattern`으로 후보 탐색 → 심볼릭 도구로 진입

## 메모리

- 프로젝트 진행 상황, 작업 컨텍스트를 `write_memory`로 `.serena/memories/`에 저장
- 다른 PC에서 `read_memory`로 복원 가능
- 세션 간 컨텍스트 공유에 활용

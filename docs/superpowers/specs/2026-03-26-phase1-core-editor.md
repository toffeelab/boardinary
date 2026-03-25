# Phase 1 코어 에디터 스펙

## 개요

스토리보드 에디터의 핵심 기능을 구현한다. 노드 기반 플로우차트 캔버스에서 씬/이벤트/분기를 생성하고 연결하며, 속성을 편집하고, 자동/수동 저장과 Undo/Redo를 지원한다.

## 기술 스택

- **@xyflow/react** (React Flow v12+): 노드 기반 캔버스 라이브러리
- **Zustand**: UI 상태 (패널 토글, 저장 상태, 선택된 노드 ID, undo/redo 히스토리)
- 기존 NestJS API + `@repo/types` 확장

## 노드 타입

| 타입 | 색상 | 용도 | 속성 |
|------|------|------|------|
| **씬 (scene)** | Purple (#8b5cf6) | 장면/스테이지 | 제목, 설명, 태그, 색상 |
| **이벤트 (event)** | Green (#10b981) | 게임 이벤트/트리거 | 제목, 설명, 태그, 색상 |
| **분기 (branch)** | Amber (#f59e0b) | 선택지/조건 분기 | 제목, 선택지 목록 (각각 라벨 + 연결) |

엣지(연결선): 조건 라벨 편집 가능. 분기 노드에서 나가는 엣지는 선택지와 매핑.

## 에디터 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ 탑바 (로고, 스토리보드 이름, 저장 상태, 프로필)              │
├────────┬──────────────────────────────────┬───────────────┤
│ 노드   │                                  │  속성 패널     │
│ 목록   │       캔버스 (@xyflow/react)      │  (선택 노드    │
│ (토글) │                                  │   편집)        │
│        │                                  │               │
│ 씬     │  ┌─────┐    ┌─────┐             │  제목          │
│ 이벤트  │  │ 씬1 │───▶│ 분기 │──▶ ...     │  설명          │
│ 분기   │  └─────┘    └─────┘             │  태그/색상     │
│        │                                  │               │
│        │  [+ 씬] [+ 이벤트] [+ 분기] 툴바  │               │
├────────┴──────────────────────────────────┴───────────────┤
│ 미니맵 (토글)                                              │
└──────────────────────────────────────────────────────────┘
```

- **좌측 노드 목록**: 토글 가능, 고정 너비 (Phase 1). 노드를 타입별 그룹으로 표시. 클릭 시 캔버스에서 해당 노드로 포커스
- **중앙 캔버스**: @xyflow/react. 무한 스크롤, 줌/패닝, 미니맵, **그리드 스냅** (`snapToGrid: true`, 20px 간격)
- **우측 속성 패널**: 노드 선택 시 해당 노드 속성 편집. 미선택 시 빈 상태 또는 스토리보드 메타 정보
- **하단 툴바**: 노드 추가 버튼 (씬/이벤트/분기), 연결 모드 토글
- **노드 복제**: Ctrl+D로 선택된 노드를 복제 (위치 offset +50, +50). 엣지는 복제하지 않음
- Phase 1.5에서 드래그 리사이즈 + 패널 재배치 + 그룹화/정렬 추가

## 상태 관리

### @xyflow/react 내장 상태
- `useNodesState`: 노드 위치, 데이터
- `useEdgesState`: 엣지 연결 정보

### Zustand 스토어 (`editor-store.ts`)
- `isNodeListOpen`: 좌측 노드 목록 패널 토글
- `selectedNodeId`: 현재 선택된 노드 ID (속성 패널 연동)
- `saveStatus`: "idle" | "saving" | "saved" | "error"
- `undoStack` / `redoStack`: Undo/Redo 히스토리

## 저장 방식

### 자동 저장
- 노드/엣지 변경 감지 후 **2초 디바운스** → NestJS API 호출
- `PATCH /api/storyboards/:id` (body: `{ content }`)

### 수동 저장
- **Ctrl+S** (Mac: Cmd+S): 즉시 저장, 디바운스 취소

### 저장 상태 표시
- 탑바에 표시: "저장 중..." / "모든 변경사항 저장됨" / "저장 실패"

### 페이지 이탈 경고
- 미저장 변경사항이 있을 때 페이지 이탈 시 `beforeunload` 경고

## Undo/Redo

### 커맨드 패턴
- 추적 액션: 노드 추가/삭제/이동/복제/속성변경, 엣지 추가/삭제, 분기 선택지 변경
- **Ctrl+Z**: Undo
- **Ctrl+Y** 또는 **Ctrl+Shift+Z**: Redo
- **Ctrl+D**: 선택된 노드 복제 (옆에 배치, 엣지는 복제하지 않음)

### 구현 방식: 이뮤터블 스냅샷
- **노드/엣지 배열만** 스냅샷으로 저장 (viewport 제외 — 가볍게 유지)
- Zustand 스토어에 `undoStack`, `redoStack` 관리
- 새 액션 발생 시 `redoStack` 초기화
- **메모리 제한**: 스택당 최대 50개 항목. 초과 시 가장 오래된 항목 제거
- `immer` 또는 구조적 공유(structural sharing)로 메모리 효율 확보

## API 변경

### 선행 작업 (에디터 구현 전 반드시 완료)

1. `@repo/types`의 `UpdateStoryboardDto`에 `content` (optional) 필드 추가
2. `apps/api`의 `update-storyboard.dto.ts`에 `content` 필드 + class-validator 추가
3. `StoryboardsService.updateStoryboard`에서 `content` + `content_version` 업데이트 허용
4. content Zod 스키마로 구조 검증 (version, nodes, edges 구조 확인)
5. content 크기 제한: 최대 5MB
6. `content_version`을 낙관적 잠금(optimistic lock)으로 활용

### 기존 엔드포인트 활용
```
GET   /api/storyboards/:id     → content 포함 전체 로드 (기존)
PATCH /api/storyboards/:id     → content 업데이트 + content_version 증가
```

### 낙관적 동시성 제어
- 저장 시 요청 body에 `contentVersion` 포함
- 서버: `WHERE id = :id AND content_version = :expectedVersion`으로 업데이트
- 성공 시 `content_version` + 1, 응답에 새 버전 반환
- 실패 시 409 Conflict 반환 → 클라이언트에서 "다른 곳에서 변경됨 — 새로고침?" 다이얼로그

### 자동 저장 실패 처리
- 실패 시 3초 후 1회 재시도
- 재시도 실패 시 "저장 실패 — 다시 시도" 배너 표시 (수동 재시도 버튼)
- 409 Conflict 시 "다른 곳에서 변경됨 — 새로고침?" 다이얼로그
- 충돌 해결 전까지 자동 저장 중지

### Viewport 저장 분리
- **viewport(pan/zoom) 변경은 자동 저장을 트리거하지 않음**
- viewport는 Ctrl+S(수동 저장) 시 또는 페이지 이탈 시에만 저장
- 불필요한 API 호출 방지

## 버전 필드 정의

- **`content_version` (DB 컬럼)**: 낙관적 동시성 제어 토큰. 저장할 때마다 +1. 충돌 감지용
- **`version` (JSON 내부)**: content 스키마 버전. 스키마 구조가 변경될 때만 증가 (1 → 2). 마이그레이션용

> Phase 0의 content 스키마 초안(`elements`/`connections`)은 Phase 1의 `nodes`/`edges`로 대체됨. Phase 0 스토리보드는 모두 `content: {}`이므로 마이그레이션 불필요.

### Content 마이그레이션 함수
- `migrateContent(content: unknown): ContentV1` — 로드 시 content를 검증하고 필요 시 업그레이드
- 빈 객체 `{}` → 기본 구조 `{ version: 1, viewport: ..., nodes: [], edges: [] }`로 변환
- 알 수 없는 버전 → 에러 표시

## 분기 노드 ↔ 엣지 동기화 규칙

- 분기 노드의 각 선택지(choice)는 고유 `id`를 가지며, 이 id가 엣지의 `sourceHandle`과 매핑
- **선택지 삭제 시**: 해당 `sourceHandle`을 참조하는 엣지도 자동 삭제
- **선택지 추가 시**: 엣지는 자동 생성되지 않음 (사용자가 수동으로 연결)
- **엣지 드래그**: 분기 노드에서 엣지를 드래그할 때 핸들 선택 UI 표시 (어떤 선택지에서 나가는지)

## Content 스키마 (jsonb)

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [
    {
      "id": "node-1",
      "type": "scene",
      "position": { "x": 100, "y": 200 },
      "data": {
        "title": "시작의 마을",
        "description": "플레이어가 처음 도착하는 마을",
        "tags": ["intro", "tutorial"],
        "color": "#8b5cf6"
      }
    },
    {
      "id": "node-2",
      "type": "branch",
      "position": { "x": 300, "y": 200 },
      "data": {
        "title": "동굴 입장 여부",
        "choices": [
          { "id": "c1", "label": "동굴에 들어간다" },
          { "id": "c2", "label": "마을에 남는다" }
        ]
      }
    },
    {
      "id": "node-3",
      "type": "event",
      "position": { "x": 500, "y": 100 },
      "data": {
        "title": "보스 출현",
        "description": "동굴 깊은 곳에서 보스가 나타남",
        "tags": ["combat"],
        "color": "#10b981"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "label": ""
    },
    {
      "id": "edge-2",
      "source": "node-2",
      "sourceHandle": "c1",
      "target": "node-3",
      "label": "동굴 선택 시"
    }
  ]
}
```

## 파일 구조

### 신규 파일
```
apps/web/src/
├── components/
│   └── storyboard/
│       ├── editor.tsx              # 메인 에디터 컴포넌트 (레이아웃 조립)
│       ├── canvas.tsx              # @xyflow/react 래퍼 (캔버스 영역)
│       ├── nodes/
│       │   ├── scene-node.tsx      # 씬 커스텀 노드
│       │   ├── event-node.tsx      # 이벤트 커스텀 노드
│       │   └── branch-node.tsx     # 분기 커스텀 노드
│       ├── edges/
│       │   └── labeled-edge.tsx    # 조건 라벨 커스텀 엣지
│       ├── panels/
│       │   ├── node-list-panel.tsx # 좌측 노드 목록 패널
│       │   ├── property-panel.tsx  # 우측 속성 편집 패널
│       │   └── toolbar.tsx         # 하단 노드 추가 툴바
│       └── hooks/
│           ├── use-auto-save.ts    # 자동 저장 훅 (디바운스)
│           └── use-undo-redo.ts    # Undo/Redo 훅
├── stores/
│   └── editor-store.ts            # 에디터 UI 상태 Zustand 스토어
```

### 수정 파일
```
apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/[id]/page.tsx
  → 플레이스홀더 제거, <StoryboardEditor> 연결

packages/types/src/storyboards.ts
  → UpdateStoryboardDto에 content 필드 추가

apps/api/src/storyboards/dto/update-storyboard.dto.ts
  → content 필드 추가 (optional)

apps/api/src/storyboards/storyboards.service.ts
  → updateStoryboard에서 content 업데이트 허용
```

## 의존성 추가

```
apps/web:
  @xyflow/react    # 캔버스 라이브러리
  zustand          # 상태 관리 (이미 CLAUDE.md에 명시, 미설치)
```

## Phase 1 범위 외 (이연)

| 항목 | 이연 시점 |
|------|----------|
| 드래그 리사이즈 + 패널 재배치 | Phase 1.5 |
| 레이아웃 설정 저장 | Phase 1.5 |
| 노드 리사이즈 핸들 | Phase 1.5 |
| 그룹화/정렬/분배 | Phase 1.5 |
| 연결선 유효성 검증 (순환 참조 감지) | Phase 1.5 |
| 드래그 미리보기/유효 드롭 영역 | Phase 1.5 |
| 커스텀 노드 타입 추가 | Phase 2 (템플릿) |
| 리치 텍스트 에디터 (마크다운/WYSIWYG) | Phase 2+ |
| 이미지 첨부 | Phase 2+ |
| 실시간 협업 (CRDT) | Phase 3 |
| 버전 스냅샷/타임라인 | Phase 4 |

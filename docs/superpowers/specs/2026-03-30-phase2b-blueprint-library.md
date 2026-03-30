# Phase 2b: Blueprint Library Design Spec

## 개요

사용자가 자주 쓰는 요소/흐름을 "블루프린트"로 저장하고 재사용하는 시스템. 단일 요소 프리셋과 다중 요소 플로우 패턴을 모두 지원.

## 블루프린트 타입

| 타입                | 설명                    | 예시                                |
| ------------------- | ----------------------- | ----------------------------------- |
| **프리셋 (preset)** | 단일 요소 + 속성 템플릿 | "보스 전투 이벤트", "NPC 인사 대사" |
| **플로우 (flow)**   | 여러 노드 + 엣지 묶음   | "퀘스트 수락 흐름", "전투 루프"     |

## DB 스키마

```sql
CREATE TYPE blueprint_type AS ENUM ('preset', 'flow', 'template');
CREATE TYPE blueprint_scope AS ENUM ('personal', 'organization', 'project');

CREATE TABLE blueprints (
  id              TEXT PRIMARY KEY,  -- cuid
  type            blueprint_type NOT NULL,
  scope           blueprint_scope NOT NULL,
  created_by      TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  org_id          TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description     TEXT,
  content         JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_version INTEGER NOT NULL DEFAULT 1,
  tags            TEXT[],
  icon            TEXT,
  color           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT chk_blueprints_scope CHECK (
    (scope = 'personal'     AND org_id IS NULL     AND project_id IS NULL) OR
    (scope = 'organization' AND org_id IS NOT NULL AND project_id IS NULL) OR
    (scope = 'project'      AND org_id IS NOT NULL AND project_id IS NOT NULL)
  )
);

CREATE INDEX idx_blueprints_personal ON blueprints (created_by) WHERE scope = 'personal';
CREATE INDEX idx_blueprints_org      ON blueprints (org_id, type) WHERE scope = 'organization';
CREATE INDEX idx_blueprints_project  ON blueprints (project_id, type) WHERE scope = 'project';
CREATE INDEX idx_blueprints_tags     ON blueprints USING GIN (tags);

CREATE TRIGGER trg_blueprints_updated_at
  BEFORE UPDATE ON blueprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 스키마 설계 원칙

- `blueprints` 테이블명: "components"는 React UI 컴포넌트와 충돌하므로 회피
- `blueprint_type`/`blueprint_scope`: pgEnum으로 DB 레벨 타입 안전
- `created_by NOT NULL`: 기존 storyboards 컨벤션과 일치, 모든 블루프린트에 생성자 필수
- `content_version`: 콘텐츠 스키마 변경 시 마이그레이션 지원
- CHECK constraint: scope별 FK 정합성 보장
- Partial index: scope별 쿼리 패턴에 최적화

## 공유 범위

| scope            | 볼 수 있는 사람 | 만들 수 있는 사람 |
| ---------------- | --------------- | ----------------- |
| **personal**     | 본인만          | 본인              |
| **organization** | 조직 전체       | 조직 멤버         |

Phase 2b에서는 personal/organization만 사용. project scope는 스키마만 준비, 추후 활성화.

## API (NestJS)

```
GET    /api/blueprints?scope=personal              → 내 블루프린트
GET    /api/blueprints?scope=organization&orgId=xxx → 조직 블루프린트
POST   /api/blueprints                              → 블루프린트 생성
GET    /api/blueprints/:id                          → 블루프린트 상세
PATCH  /api/blueprints/:id                          → 블루프린트 수정
DELETE /api/blueprints/:id                          → 블루프린트 삭제
```

## 블루프린트 저장 UX

### 캔버스에서 저장

1. 요소 선택 (단일 또는 다중)
2. 우클릭 → "블루프린트로 저장" 또는 Ctrl+Shift+S
3. 다이얼로그: 이름, 설명, 타입(자동 감지: 1개=preset, 2개+=flow), 공유범위, 태그
4. 저장 → API → DB

- **프리셋**: 선택한 노드의 type + data 저장
- **플로우**: 선택한 노드들 + 사이 엣지 저장. 위치는 상대좌표로 변환

## 블루프린트 사용 UX

### 사이드바 "블루프린트" 탭

- 좌측 패널에 탭 추가: "요소" | "블루프린트"
- 블루프린트 탭: 내 블루프린트 + 조직 블루프린트 (scope별 그룹)
- 검색/필터 (타입, 태그)
- 클릭 → 캔버스 중앙에 삽입 (복사본, 원본과 연결 없음)
- 드래그 앤 드롭 지원 (Phase 1.5 DnD 인프라 활용)

## 블루프린트 편집

### 동일 에디터 재사용

- 사이드바에서 블루프린트 더블클릭 또는 "편집" 버튼
- `/dashboard/[orgSlug]/blueprints/[id]/edit` 라우트
- `StoryboardEditor`를 `mode="blueprint"` prop으로 재사용
- 저장 대상만 `PATCH /api/blueprints/:id`로 변경
- 에디터 헤더에 "블루프린트 편집 중" 표시

## 파일 구조

```
apps/web/src/
├── app/dashboard/[orgSlug]/blueprints/
│   └── [id]/edit/page.tsx              # 블루프린트 편집 페이지
├── actions/
│   └── blueprint-actions.ts            # 블루프린트 Server Actions
├── components/storyboard/
│   ├── panels/
│   │   └── blueprint-panel.tsx         # 사이드바 블루프린트 탭
│   └── hooks/
│       └── use-blueprint-actions.ts    # 저장/삽입 로직

apps/api/src/
├── blueprints/
│   ├── blueprints.module.ts
│   ├── blueprints.controller.ts
│   ├── blueprints.service.ts
│   └── dto/
│       ├── create-blueprint.dto.ts
│       └── update-blueprint.dto.ts

packages/db/src/schema.ts              # blueprints 테이블 추가
packages/types/src/blueprints.ts       # BlueprintDto 등
```

## 타입 정의

```ts
// packages/types/src/blueprints.ts
export interface BlueprintDto {
  id: string;
  type: "preset" | "flow" | "template";
  scope: "personal" | "organization" | "project";
  createdBy: string;
  orgId: string | null;
  projectId: string | null;
  name: string;
  description: string | null;
  content: Record<string, unknown>; // { nodes: [...], edges: [...] }
  contentVersion: number;
  tags: string[] | null;
  icon: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlueprintDto {
  type: "preset" | "flow";
  scope: "personal" | "organization";
  orgId?: string;
  name: string;
  description?: string;
  content: Record<string, unknown>;
  tags?: string[];
  icon?: string;
  color?: string;
}

export interface UpdateBlueprintDto {
  name?: string;
  description?: string;
  content?: Record<string, unknown>;
  tags?: string[];
  icon?: string;
  color?: string;
}
```

## 추후 확장 (Phase 2c+)

- 프리팹 패턴: 블루프린트와 인스턴스 간 참조(componentId) 유지, 원본 업데이트 전파
- 프로젝트 scope 활성화
- 블루프린트 마켓플레이스 (조직 간 공유)
- usage_count 트래킹

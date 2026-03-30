# Phase 2a: 장르 템플릿 + 커스텀 노드 타입 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 에디터에 대사/조건/메모 노드 3종을 추가하고, RPG/액션/퍼즐 장르 템플릿 3종을 제공하여 스토리보드 생성 시 + 에디터 내에서 적용할 수 있게 한다.

**Architecture:** 새 노드 타입은 기존 커스텀 노드 패턴을 따라 추가. 템플릿은 `StoryboardContentV1` JSON으로 코드에 내장. 스토리보드 생성 시 템플릿 선택 → content 초기값 설정. 에디터 내 적용은 기존 노드에 템플릿 노드를 오프셋하여 추가.

**Tech Stack:** 기존 @xyflow/react + @repo/types 확장. vitest (테스트).

**Spec:** `docs/superpowers/specs/2026-03-30-phase2a-templates-nodes.md`

---

## 파일 구조

### 신규 파일
```
apps/web/
├── vitest.config.ts              # vitest 설정
├── src/
│   ├── components/storyboard/
│   │   ├── nodes/
│   │   │   ├── dialogue-node.tsx
│   │   │   ├── condition-node.tsx
│   │   │   └── note-node.tsx
│   │   ├── panels/
│   │   │   └── template-browser.tsx
│   │   ├── templates/
│   │   │   ├── index.ts
│   │   │   ├── rpg.ts
│   │   │   ├── action-fps.ts
│   │   │   └── puzzle.ts
│   │   └── hooks/
│   │       └── __tests__/
│   │           └── use-edge-validation.test.ts
│   ├── lib/
│   │   └── __tests__/
│   │       └── content-migration.test.ts
│   └── test/
│       └── setup.ts              # vitest setup
```

### 수정 파일
```
packages/types/src/storyboards.ts → type union + data 필드 확장
apps/web/src/lib/content-migration.ts → VALID_NODE_TYPES 추가
apps/web/src/components/storyboard/hooks/use-auto-save.ts → 타입 캐스트 수정
apps/web/src/components/storyboard/nodes/node-types.ts → 새 노드 등록
apps/web/src/components/storyboard/panels/toolbar.tsx → 새 버튼 + 템플릿 버튼
apps/web/src/components/storyboard/panels/property-panel.tsx → 새 타입별 UI
apps/web/src/components/storyboard/panels/node-list-panel.tsx → 새 타입 그룹
apps/web/src/components/storyboard/editor.tsx → 템플릿 적용 로직
apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/new/page.tsx → 템플릿 선택
```

---

## Task 0: 테스트 인프라 (vitest 세팅 + 기존 로직 테스트)

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/lib/__tests__/content-migration.test.ts`
- Create: `apps/web/src/components/storyboard/hooks/__tests__/use-edge-validation.test.ts`

- [ ] **Step 1: vitest 설치**

```bash
pnpm --filter web add -D vitest @vitejs/plugin-react
```

- [ ] **Step 2: vitest.config.ts 생성**

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@repo/types": path.resolve(__dirname, "../../packages/types/src"),
    },
  },
});
```

- [ ] **Step 3: test setup**

`apps/web/src/test/setup.ts`:
```ts
// vitest global setup
```

- [ ] **Step 4: package.json에 test 스크립트 추가**

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: content-migration.test.ts — 기존 로직 테스트**

```ts
import { describe, it, expect } from "vitest";
import { migrateContent } from "@/lib/content-migration";

describe("migrateContent", () => {
  it("빈 객체 → 기본 구조", () => {
    const result = migrateContent({});
    expect(result.version).toBe(1);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("null/undefined → 기본 구조", () => {
    expect(migrateContent(null).nodes).toEqual([]);
    expect(migrateContent(undefined).nodes).toEqual([]);
  });

  it("유효한 v1 content 보존", () => {
    const content = {
      version: 1,
      viewport: { x: 10, y: 20, zoom: 1.5 },
      nodes: [
        { id: "n1", type: "scene", position: { x: 0, y: 0 }, data: { title: "test" } },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    };
    const result = migrateContent(content);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(1);
    expect(result.viewport.zoom).toBe(1.5);
  });

  it("잘못된 노드 타입 필터링", () => {
    const content = {
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        { id: "n1", type: "scene", position: { x: 0, y: 0 }, data: { title: "ok" } },
        { id: "n2", type: "invalid", position: { x: 0, y: 0 }, data: { title: "bad" } },
      ],
      edges: [],
    };
    const result = migrateContent(content);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe("n1");
  });

  it("알 수 없는 버전 → 빈 상태", () => {
    const result = migrateContent({ version: 99 });
    expect(result.nodes).toEqual([]);
  });
});
```

- [ ] **Step 6: use-edge-validation.test.ts — 엣지 검증 테스트**

```ts
import { describe, it, expect } from "vitest";

// hasCycle 함수를 직접 테스트하기 위해 모듈에서 export 필요
// 또는 테스트용으로 로직만 추출

describe("edge validation", () => {
  it("자기 자신 연결 거부", () => {
    // isValidConnection({ source: "a", target: "a" }) → false
  });

  it("중복 연결 거부", () => {
    // 이미 a→b 엣지 존재 시 동일 연결 거부
  });

  it("순환 참조 감지", () => {
    // a→b→c 존재 시 c→a 연결 → 거부
  });

  it("유효한 연결 허용", () => {
    // a→b 존재 시 a→c 연결 → 허용
  });
});
```

> **Note**: `hasCycle` 함수를 `use-edge-validation.ts`에서 export하거나, 별도 유틸리티로 추출하여 테스트 가능하게 만들어야 함.

- [ ] **Step 7: 테스트 실행 + 커밋**

```bash
pnpm --filter web test
git commit -m "feat: setup vitest + add tests for content-migration and edge-validation"
```

---

## Task 1: 타입 확장 + content-migration + auto-save 수정

**Files:**
- Modify: `packages/types/src/storyboards.ts`
- Modify: `apps/web/src/lib/content-migration.ts`
- Modify: `apps/web/src/components/storyboard/hooks/use-auto-save.ts`

- [ ] **Step 1: @repo/types에 새 노드 타입 + 데이터 필드 추가**

`packages/types/src/storyboards.ts`의 `StoryboardNode.type`에 추가:
```ts
type: "scene" | "event" | "branch" | "group" | "dialogue" | "condition" | "note";
```

`StoryboardNodeData`에 추가:
```ts
speaker?: string;       // dialogue
dialogueText?: string;  // dialogue
conditionExpr?: string; // condition
```

- [ ] **Step 2: content-migration.ts — VALID_NODE_TYPES 업데이트**

```ts
const VALID_NODE_TYPES = new Set([
  "scene", "event", "branch", "group",
  "dialogue", "condition", "note",
]);
```

- [ ] **Step 3: use-auto-save.ts — toContentV1 타입 캐스트 수정**

기존 `as "scene" | "event" | "branch"` 캐스트를 `as StoryboardNode["type"]`로 변경하거나, 타입 캐스트를 제거하고 `n.type!`로 대체.

- [ ] **Step 4: content-migration 테스트 업데이트**

`content-migration.test.ts`에 새 노드 타입 테스트 추가:
```ts
it("dialogue 노드 타입 허용", () => {
  const content = {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      { id: "n1", type: "dialogue", position: { x: 0, y: 0 }, data: { title: "대사", speaker: "NPC" } },
    ],
    edges: [],
  };
  const result = migrateContent(content);
  expect(result.nodes).toHaveLength(1);
  expect(result.nodes[0].type).toBe("dialogue");
});

it("condition 노드 타입 허용", () => { ... });
it("note 노드 타입 허용", () => { ... });
```

- [ ] **Step 5: 테스트 실행 + 빌드 + 커밋**

```bash
pnpm --filter web test
pnpm build
git commit -m "feat: extend types with dialogue/condition/note node types"
```

---

## Task 2: 대사 노드 (dialogue-node.tsx)

**Files:**
- Create: `apps/web/src/components/storyboard/nodes/dialogue-node.tsx`
- Modify: `apps/web/src/components/storyboard/nodes/node-types.ts`

- [ ] **Step 1: dialogue-node.tsx**

기존 scene-node.tsx 패턴을 따라 구현:
- 색상: Blue (#3b82f6)
- 라벨: "대사"
- 좌측 target 핸들, 우측 source 핸들
- 화자(speaker) 표시 (있으면 bold)
- 대사 텍스트 미리보기 (2줄 제한)
- NodeResizer 포함 (선택 시)

- [ ] **Step 2: node-types.ts에 dialogue 등록**

```ts
import { DialogueNode } from "./dialogue-node";
// ...
export const nodeTypes = {
  scene: SceneNode,
  event: EventNode,
  branch: BranchNode,
  group: GroupNode,
  dialogue: DialogueNode,
  // condition, note는 다음 Task에서
};
```

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
git commit -m "feat: add dialogue node component"
```

---

## Task 3: 조건 노드 (condition-node.tsx) + 메모 노드 (note-node.tsx)

**Files:**
- Create: `apps/web/src/components/storyboard/nodes/condition-node.tsx`
- Create: `apps/web/src/components/storyboard/nodes/note-node.tsx`
- Modify: `apps/web/src/components/storyboard/nodes/node-types.ts`

- [ ] **Step 1: condition-node.tsx**

- 색상: Red (#ef4444)
- 라벨: "조건"
- 좌측 target 핸들
- 우측 source 핸들 2개 고정: `true` (id="true", Green 색상), `false` (id="false", Red 색상)
- conditionExpr 텍스트 표시
- NodeResizer 포함

- [ ] **Step 2: note-node.tsx**

- 색상: Gray (#6b7280)
- 점선 테두리, 반투명 배경 (스티커 노트 스타일)
- **핸들 없음** — 엣지 연결 불가
- 제목 + 설명 텍스트 표시
- NodeResizer 포함

- [ ] **Step 3: node-types.ts에 condition, note 등록**

```ts
export const nodeTypes = {
  scene: SceneNode,
  event: EventNode,
  branch: BranchNode,
  group: GroupNode,
  dialogue: DialogueNode,
  condition: ConditionNode,
  note: NoteNode,
};
```

- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
git commit -m "feat: add condition and note node components"
```

---

## Task 4: 패널 업데이트 (툴바 + 속성 패널 + 노드 목록)

**Files:**
- Modify: `apps/web/src/components/storyboard/panels/toolbar.tsx`
- Modify: `apps/web/src/components/storyboard/panels/property-panel.tsx`
- Modify: `apps/web/src/components/storyboard/panels/node-list-panel.tsx`

- [ ] **Step 1: toolbar.tsx — 새 노드 추가 버튼**

기존 "+ 씬", "+ 이벤트", "+ 분기" 옆에:
- "+ 대사" (blue dot)
- "+ 조건" (red dot)
- "+ 메모" (gray dot)

모두 동일한 `onAddNode(type)` 콜백 사용. `draggable` + `onDragStart`도 동일 적용.

버튼이 많아지므로 2줄로 배치하거나, 스크롤 가능한 래퍼 사용.

- [ ] **Step 2: property-panel.tsx — 새 타입별 속성 편집**

선택된 노드 타입에 따라 다른 필드 표시:
- `dialogue`: speaker 입력, dialogueText textarea, 태그, 색상
- `condition`: conditionExpr 입력, 태그, 색상
- `note`: description textarea만 (태그/색상 선택사항)
- 기존 타입: 변경 없음

- [ ] **Step 3: node-list-panel.tsx — 새 타입 그룹**

기존 씬/이벤트/분기 그룹에 추가:
- 대사 (blue, #3b82f6)
- 조건 (red, #ef4444)
- 메모 (gray, #6b7280)

- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
git commit -m "feat: update panels for dialogue/condition/note node types"
```

---

## Task 5: 장르 템플릿 JSON 작성

**Files:**
- Create: `apps/web/src/components/storyboard/templates/index.ts`
- Create: `apps/web/src/components/storyboard/templates/rpg.ts`
- Create: `apps/web/src/components/storyboard/templates/action-fps.ts`
- Create: `apps/web/src/components/storyboard/templates/puzzle.ts`

- [ ] **Step 1: templates/index.ts — 인터페이스 + 레지스트리**

```ts
import type { StoryboardContentV1 } from "@repo/types";

export interface StoryboardTemplate {
  id: string;
  name: string;
  genre: string;
  description: string;
  nodeCount: number;
  content: StoryboardContentV1;
}

export { rpgTemplate } from "./rpg";
export { actionFpsTemplate } from "./action-fps";
export { puzzleTemplate } from "./puzzle";

export const templates: StoryboardTemplate[] = [
  rpgTemplate,
  actionFpsTemplate,
  puzzleTemplate,
];
```

- [ ] **Step 2: rpg.ts**

`StoryboardContentV1` 형태의 RPG 템플릿:
- 씬(시작 마을) → 대사(NPC 대화) → 분기(퀘스트 수락?) → 씬(던전) → 이벤트(보스 전투) → 분기(승리?) → 씬(엔딩)
- 메모: "보상 아이템을 추가하세요"
- 노드 8개 + 엣지 7개
- 노드 위치를 가로로 적절히 배치 (x: 0, 250, 500, ...)

- [ ] **Step 3: action-fps.ts**

액션/FPS 템플릿:
- 씬(브리핑) → 이벤트(미션 시작) → 조건(목표 달성?) → 분기(성공/실패) → 씬(결과)
- 메모: "웨이포인트를 추가하세요"

- [ ] **Step 4: puzzle.ts**

퍼즐 템플릿:
- 씬(퍼즐 소개) → 조건(힌트 사용?) → 이벤트(퍼즐 시도) → 조건(정답?) → 분기(다음/재시도) → 씬(클리어)
- 메모: "난이도별 분기를 추가하세요"

- [ ] **Step 5: 템플릿 구조 검증 테스트**

`apps/web/src/components/storyboard/templates/__tests__/templates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { templates } from "../index";
import { migrateContent } from "@/lib/content-migration";

describe("genre templates", () => {
  it.each(templates)("$name 템플릿이 유효한 StoryboardContentV1 구조", (template) => {
    expect(template.id).toBeTruthy();
    expect(template.content.version).toBe(1);
    expect(template.content.nodes.length).toBeGreaterThan(0);
    expect(template.content.edges.length).toBeGreaterThan(0);
  });

  it.each(templates)("$name 템플릿이 migrateContent를 통과", (template) => {
    const migrated = migrateContent(template.content);
    expect(migrated.nodes.length).toBe(template.content.nodes.length);
  });

  it("3개 템플릿 존재", () => {
    expect(templates).toHaveLength(3);
  });
});
```

- [ ] **Step 6: 테스트 실행 + 빌드 + 커밋**

```bash
pnpm --filter web test
pnpm --filter web build
git commit -m "feat: add genre templates (RPG, Action/FPS, Puzzle)"
```

---

## Task 6: 템플릿 브라우저 (모달)

**Files:**
- Create: `apps/web/src/components/storyboard/panels/template-browser.tsx`

- [ ] **Step 1: template-browser.tsx**

모달 컴포넌트:
- `open` / `onClose` / `onApply(template: StoryboardTemplate)` props
- 템플릿 카드 목록 (이름, 장르, 설명, 노드 수)
- 카드 클릭 → 선택 하이라이트
- "적용" 버튼 → `onApply` 콜백
- shadcn Dialog 또는 커스텀 모달 사용

- [ ] **Step 2: 빌드 확인 + 커밋**

```bash
git commit -m "feat: add template browser modal component"
```

---

## Task 7: 에디터에 템플릿 적용 로직

**Files:**
- Modify: `apps/web/src/components/storyboard/editor.tsx`
- Modify: `apps/web/src/components/storyboard/panels/toolbar.tsx`

- [ ] **Step 1: toolbar.tsx에 "템플릿" 버튼 추가**

툴바에 "📋 템플릿" 버튼. 클릭 시 `onOpenTemplates()` 콜백.

- [ ] **Step 2: editor.tsx — 템플릿 적용 로직**

`handleApplyTemplate(template: StoryboardTemplate)`:
1. 현재 노드의 바운딩 박스 계산
2. 템플릿 노드의 위치를 오프셋 (바운딩 박스 우측 + 200px)
3. 템플릿의 노드/엣지에 새 ID 부여 (uuid)
4. 현재 노드/엣지에 추가
5. Undo 스냅샷 push + 자동 저장

`TemplateBrowser` 모달 상태 관리 (isOpen/setIsOpen).

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
git commit -m "feat: wire template application in editor"
```

---

## Task 8: 스토리보드 생성 페이지에 템플릿 선택

**Files:**
- Modify: `apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/new/page.tsx`
- Modify: `apps/web/src/actions/storyboard-actions.ts`

- [ ] **Step 1: 생성 페이지에 템플릿 카드 추가**

기존 폼 위에 템플릿 선택 섹션:
- "빈 캔버스" 카드 (기본 선택)
- RPG / 액션/FPS / 퍼즐 카드
- 선택 시 hidden input에 templateId 설정

Client Component로 전환 필요 (선택 상태 관리).

- [ ] **Step 2: storyboard-actions.ts 수정**

`createStoryboardAction`에서 `templateId`를 받으면:
1. 해당 템플릿의 content를 가져옴 (import)
2. `content` 파라미터로 NestJS API에 전달

단, 현재 `CreateStoryboardDto`에 `content`가 없으므로:
- `@repo/types`의 `CreateStoryboardDto`에 `content?: StoryboardContentV1` 추가
- NestJS `create-storyboard.dto.ts`에 `content` (optional @IsObject) 추가
- `StoryboardsService.createStoryboard`에서 `content` 받아서 저장

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
git commit -m "feat: add template selection on storyboard creation page"
```

---

## Task 9: 전체 검증

- [ ] **Step 1: 타입 체크 + 린트 + 빌드**

```bash
pnpm check-types
pnpm lint
pnpm build
```

- [ ] **Step 2: 수동 확인**

1. 에디터: 대사/조건/메모 노드 추가 (툴바)
2. 대사 노드: speaker + dialogueText 편집
3. 조건 노드: true/false 핸들에서 엣지 연결
4. 메모 노드: 엣지 연결 불가 확인
5. 노드 목록 패널: 7종 타입 표시
6. 드래그 앤 드롭: 새 노드 타입도 가능
7. 템플릿 적용 (에디터 내): 모달에서 RPG 선택 → 노드 추가
8. 새 스토리보드 생성: 템플릿 선택 → 에디터 진입 시 노드 배치 확인
9. 새로고침 → 저장된 상태 복원 (새 노드 타입 포함)
10. Undo/Redo: 새 노드 타입도 정상 동작

- [ ] **Step 3: 커밋**

```bash
git commit -m "chore: Phase 2a templates + custom nodes complete"
```

---

## 태스크 의존성

```
Task 0 (vitest 세팅) → Task 1 (타입 확장 + 테스트) → Task 2 (대사) → Task 3 (조건+메모) → Task 4 (패널)
                                                                                              ↓
Task 5 (템플릿 JSON + 테스트) → Task 6 (브라우저) → Task 7 (에디터 연동) → Task 8 (생성 페이지) → Task 9 (검증)
```

## 의존성 추가

| 패키지 | 용도 |
|--------|------|
| `vitest` | 테스트 프레임워크 |
| `@vitejs/plugin-react` | vitest React 지원 |

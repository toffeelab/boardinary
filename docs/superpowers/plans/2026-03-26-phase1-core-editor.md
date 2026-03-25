# Phase 1: 코어 에디터 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** @xyflow/react 기반 노드 에디터로 씬/이벤트/분기를 생성·연결·편집하고, 자동/수동 저장 + Undo/Redo를 지원한다.

**Architecture:** @xyflow/react가 캔버스 상태를 관리하고, Zustand는 UI 상태(패널 토글, 저장 상태, undo/redo)만 담당. 저장은 **Server Action**을 통해 NestJS API `PATCH /api/storyboards/:id`로 content jsonb 업데이트 (클라이언트에서 직접 NestJS 호출 불가 — INTERNAL_API_SECRET은 서버 전용). 낙관적 잠금(content_version)으로 충돌 방지.

**중요 제약사항:**
- `apiClient`는 서버 전용 (process.env.INTERNAL_API_SECRET). 클라이언트 컴포넌트에서는 **Server Action**을 통해 저장 호출해야 함
- @xyflow/react v12에서 `selected` prop은 `NodeProps`에 없음. 노드 선택 상태는 `useStore()`로 확인
- content Zod 검증 필요 (NestJS 서버 사이드)

**Tech Stack:** @xyflow/react, Zustand, 기존 NestJS API + @repo/types 확장

**Spec:** `docs/superpowers/specs/2026-03-26-phase1-core-editor.md`

**Worktree:** Phase 0과 동일한 방식으로 생성 (`feature/2026-03-26/phase1-core-editor`)

---

## 파일 구조

### 신규 파일

```
apps/web/src/
├── components/
│   └── storyboard/
│       ├── editor.tsx              # 메인 에디터 (레이아웃 조립, "use client")
│       ├── canvas.tsx              # @xyflow/react 래퍼
│       ├── nodes/
│       │   ├── scene-node.tsx      # 씬 커스텀 노드
│       │   ├── event-node.tsx      # 이벤트 커스텀 노드
│       │   ├── branch-node.tsx     # 분기 커스텀 노드
│       │   └── node-types.ts      # nodeTypes 레지스트리
│       ├── edges/
│       │   ├── labeled-edge.tsx    # 조건 라벨 커스텀 엣지
│       │   └── edge-types.ts      # edgeTypes 레지스트리
│       ├── panels/
│       │   ├── node-list-panel.tsx # 좌측 노드 목록
│       │   ├── property-panel.tsx  # 우측 속성 편집
│       │   └── toolbar.tsx         # 하단 노드 추가 툴바
│       └── hooks/
│           ├── use-auto-save.ts    # 자동 저장 (디바운스 2초)
│           ├── use-undo-redo.ts    # Undo/Redo 히스토리
│           └── use-editor-shortcuts.ts # 키보드 단축키
├── stores/
│   └── editor-store.ts            # 에디터 UI 상태 (Zustand)
├── actions/
│   └── save-storyboard-action.ts  # Server Action — content 저장 (apiClient 경유)
├── lib/
│   └── content-migration.ts       # content 마이그레이션/검증
```

### 수정 파일

```
packages/types/src/storyboards.ts
  → UpdateStoryboardDto에 content, contentVersion 추가
  → StoryboardContentV1 타입 추가

apps/api/src/storyboards/dto/update-storyboard.dto.ts
  → content, contentVersion 필드 추가

apps/api/src/storyboards/storyboards.service.ts
  → updateStoryboard에서 content + 낙관적 잠금 처리

apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/[id]/page.tsx
  → 플레이스홀더 제거, <StoryboardEditor> 연결

apps/web/package.json
  → @xyflow/react, zustand, immer 의존성 추가
```

---

## Task 1: 백엔드 — content 업데이트 + 낙관적 잠금

**Files:**
- Modify: `packages/types/src/storyboards.ts`
- Modify: `apps/api/src/storyboards/dto/update-storyboard.dto.ts`
- Modify: `apps/api/src/storyboards/storyboards.service.ts`

- [ ] **Step 1: @repo/types에 content 타입 추가**

`packages/types/src/storyboards.ts`에 추가:
```ts
export interface StoryboardNodeData {
  title: string;
  description?: string;
  tags?: string[];
  color?: string;
  choices?: Array<{ id: string; label: string }>;  // branch 노드용
}

export interface StoryboardNode {
  id: string;
  type: "scene" | "event" | "branch";
  position: { x: number; y: number };
  data: StoryboardNodeData;
}

export interface StoryboardEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface StoryboardContentV1 {
  version: 1;
  viewport: { x: number; y: number; zoom: number };
  nodes: StoryboardNode[];
  edges: StoryboardEdge[];
}

export interface UpdateStoryboardDto {
  name?: string;
  description?: string;
  genre?: string;
  tags?: string[];
  content?: StoryboardContentV1;
  contentVersion?: number;  // 낙관적 잠금용
}
```

- [ ] **Step 2: NestJS DTO에 content + contentVersion 추가**

`apps/api/src/storyboards/dto/update-storyboard.dto.ts`:
```ts
import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsInt,
  MaxLength,
} from "class-validator";
import type { UpdateStoryboardDto as IUpdateStoryboardDto } from "@repo/types";

export class UpdateStoryboardDto implements IUpdateStoryboardDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  genre?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  contentVersion?: number;
}
```

- [ ] **Step 3: StoryboardsService에 낙관적 잠금 추가**

`apps/api/src/storyboards/storyboards.service.ts`의 `updateStoryboard` 수정:
```ts
async updateStoryboard(
  id: string,
  userId: string,
  data: {
    name?: string;
    description?: string;
    genre?: string;
    tags?: string[];
    content?: Record<string, unknown>;
    contentVersion?: number;
  },
) {
  const { contentVersion, ...updateData } = data;

  // content 업데이트 시 낙관적 잠금 적용
  if (updateData.content !== undefined && contentVersion !== undefined) {
    const [storyboard] = await db
      .update(storyboards)
      .set({
        ...updateData,
        contentVersion: contentVersion + 1,
        updatedBy: userId,
      })
      .where(
        and(
          eq(storyboards.id, id),
          eq(storyboards.contentVersion, contentVersion),
        ),
      )
      .returning();

    if (!storyboard) {
      // contentVersion 불일치 → 409 Conflict
      throw new ConflictException(
        "Storyboard was modified by another session. Please reload.",
      );
    }
    return storyboard;
  }

  // content 없는 일반 업데이트 (메타데이터만)
  const [storyboard] = await db
    .update(storyboards)
    .set({ ...updateData, updatedBy: userId })
    .where(eq(storyboards.id, id))
    .returning();
  if (!storyboard) throw new NotFoundException("Storyboard not found");
  return storyboard;
}
```

`ConflictException` import 추가:
```ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
```

- [ ] **Step 4: 빌드 확인**

```bash
pnpm build
```

- [ ] **Step 5: 커밋**

```bash
git commit -m "feat: add content + contentVersion to storyboard update API with optimistic locking"
```

---

## Task 2: 프론트엔드 의존성 + Zustand 스토어 + content 마이그레이션

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/stores/editor-store.ts`
- Create: `apps/web/src/lib/content-migration.ts`

- [ ] **Step 1: 의존성 설치**

```bash
pnpm --filter web add @xyflow/react zustand immer
```

- [ ] **Step 2: editor-store.ts 생성**

`apps/web/src/stores/editor-store.ts`:
```ts
import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

interface EditorState {
  // UI 상태
  isNodeListOpen: boolean;
  selectedNodeId: string | null;
  saveStatus: "idle" | "saving" | "saved" | "error" | "conflict";
  contentVersion: number;

  // Undo/Redo
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // 액션
  toggleNodeList: () => void;
  setSelectedNodeId: (id: string | null) => void;
  setSaveStatus: (status: EditorState["saveStatus"]) => void;
  setContentVersion: (version: number) => void;

  // Undo/Redo 액션
  pushHistory: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  clearHistory: () => void;
}

const MAX_HISTORY = 50;

export const useEditorStore = create<EditorState>((set, get) => ({
  isNodeListOpen: true,
  selectedNodeId: null,
  saveStatus: "idle",
  contentVersion: 0,

  undoStack: [],
  redoStack: [],

  toggleNodeList: () =>
    set((s) => ({ isNodeListOpen: !s.isNodeListOpen })),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setContentVersion: (version) => set({ contentVersion: version }),

  pushHistory: (entry) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
      redoStack: [],
    })),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const entry = undoStack[undoStack.length - 1]!;
    set((s) => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, entry],
    }));
    return entry;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;
    const entry = redoStack[redoStack.length - 1]!;
    set((s) => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, entry],
    }));
    return entry;
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),
}));
```

- [ ] **Step 3: content-migration.ts 생성**

`apps/web/src/lib/content-migration.ts`:
```ts
import type { StoryboardContentV1 } from "@repo/types";

const EMPTY_CONTENT: StoryboardContentV1 = {
  version: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
};

export function migrateContent(raw: unknown): StoryboardContentV1 {
  if (!raw || typeof raw !== "object") return EMPTY_CONTENT;

  const content = raw as Record<string, unknown>;

  // 빈 객체 (Phase 0 기본값)
  if (Object.keys(content).length === 0) return EMPTY_CONTENT;

  // version 1 검증
  if (content.version === 1) {
    return {
      version: 1,
      viewport: (content.viewport as StoryboardContentV1["viewport"]) ??
        EMPTY_CONTENT.viewport,
      nodes: (Array.isArray(content.nodes) ? content.nodes : []) as StoryboardContentV1["nodes"],
      edges: (Array.isArray(content.edges) ? content.edges : []) as StoryboardContentV1["edges"],
    };
  }

  // 알 수 없는 버전 → 빈 상태로 fallback
  return EMPTY_CONTENT;
}
```

- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
pnpm --filter web build
git commit -m "feat: add editor Zustand store, content migration, and @xyflow/react dependency"
```

---

## Task 3: 커스텀 노드 컴포넌트 (씬/이벤트/분기)

**Files:**
- Create: `apps/web/src/components/storyboard/nodes/scene-node.tsx`
- Create: `apps/web/src/components/storyboard/nodes/event-node.tsx`
- Create: `apps/web/src/components/storyboard/nodes/branch-node.tsx`
- Create: `apps/web/src/components/storyboard/nodes/node-types.ts`

- [ ] **Step 1: scene-node.tsx**

```tsx
import { memo } from "react";
import { Handle, Position, useNodeId, useStore, type NodeProps } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";

function SceneNodeComponent({ data }: NodeProps) {
  const nodeData = data as StoryboardNodeData;
  const nodeId = useNodeId();
  const selected = useStore((s) => s.nodeLookup.get(nodeId!)?.selected ?? false);

  return (
    <div
      className={`rounded-lg border-2 bg-card px-4 py-3 shadow-sm transition-colors ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
      style={{ minWidth: 180, borderLeftColor: nodeData.color ?? "#8b5cf6", borderLeftWidth: 4 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-primary">씬</span>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">
        {nodeData.title || "제목 없음"}
      </p>
      {nodeData.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {nodeData.description}
        </p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

export const SceneNode = memo(SceneNodeComponent);
```

> **Note**: @xyflow/react v12에서 `selected`는 `NodeProps`에 없음. `useStore()`로 `nodeLookup`에서 선택 상태를 읽어야 함. 이벤트/분기 노드도 동일 패턴 적용.
> 또한, v12 API가 변경될 수 있으므로 구현 시 context7 MCP로 최신 문서를 확인할 것.

- [ ] **Step 2: event-node.tsx**

`apps/web/src/components/storyboard/nodes/event-node.tsx`:
씬 노드와 동일 구조, 색상 기본값 `#10b981`, 라벨 "이벤트"

- [ ] **Step 3: branch-node.tsx**

```tsx
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";

function BranchNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as StoryboardNodeData;
  const choices = nodeData.choices ?? [];

  return (
    <div
      className={`rounded-lg border-2 bg-card px-4 py-3 shadow-sm transition-colors ${
        selected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-border"
      }`}
      style={{ minWidth: 200, borderLeftColor: "#f59e0b", borderLeftWidth: 4 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-amber-500">분기</span>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">
        {nodeData.title || "제목 없음"}
      </p>
      {choices.length > 0 && (
        <div className="mt-2 space-y-1">
          {choices.map((choice, index) => (
            <div key={choice.id} className="relative flex items-center">
              <span className="text-xs text-muted-foreground truncate">
                {choice.label || `선택지 ${index + 1}`}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={choice.id}
                className="!bg-amber-500 !w-2.5 !h-2.5"
                style={{ top: "auto" }}
              />
            </div>
          ))}
        </div>
      )}
      {choices.length === 0 && (
        <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-3 !h-3" />
      )}
    </div>
  );
}

export const BranchNode = memo(BranchNodeComponent);
```

- [ ] **Step 4: node-types.ts**

```ts
import { SceneNode } from "./scene-node";
import { EventNode } from "./event-node";
import { BranchNode } from "./branch-node";

export const nodeTypes = {
  scene: SceneNode,
  event: EventNode,
  branch: BranchNode,
};
```

- [ ] **Step 5: 빌드 확인 + 커밋**

```bash
git commit -m "feat: add custom node components (scene, event, branch)"
```

---

## Task 4: 커스텀 엣지 + 캔버스 래퍼

**Files:**
- Create: `apps/web/src/components/storyboard/edges/labeled-edge.tsx`
- Create: `apps/web/src/components/storyboard/edges/edge-types.ts`
- Create: `apps/web/src/components/storyboard/canvas.tsx`

- [ ] **Step 1: labeled-edge.tsx**

```tsx
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={selected ? "!stroke-primary !stroke-2" : "!stroke-muted-foreground"}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute rounded bg-card px-2 py-0.5 text-xs text-muted-foreground border border-border shadow-sm pointer-events-all"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
```

- [ ] **Step 2: edge-types.ts**

```ts
import { LabeledEdge } from "./labeled-edge";

export const edgeTypes = {
  labeled: LabeledEdge,
};
```

- [ ] **Step 3: canvas.tsx**

```tsx
"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./nodes/node-types";
import { edgeTypes } from "./edges/edge-types";
import { useEditorStore } from "@/stores/editor-store";

interface CanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
}

export function Canvas({
  initialNodes,
  initialEdges,
  onNodesChange,
  onEdgesChange,
}: CanvasProps) {
  const [nodes, setNodes, onNodesChangeHandler] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeHandler] = useEdgesState(initialEdges);
  const { setSelectedNodeId } = useEditorStore();

  const handleConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: "labeled" }, eds));
    },
    [setEdges],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      setSelectedNodeId(selectedNodes[0]?.id ?? null);
    },
    [setSelectedNodeId],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: "labeled" }}
        snapToGrid
        snapGrid={[20, 20]}
        fitView
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "scene") return "#8b5cf6";
            if (node.type === "event") return "#10b981";
            if (node.type === "branch") return "#f59e0b";
            return "#6b7280";
          }}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

> **Note**: canvas.tsx는 뼈대만 만들고, 자동 저장/Undo 연동은 Task 6에서 추가.

- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
git commit -m "feat: add labeled edge, edge types, and canvas wrapper component"
```

---

## Task 5: 패널 컴포넌트 (노드 목록, 속성 편집, 툴바)

**Files:**
- Create: `apps/web/src/components/storyboard/panels/node-list-panel.tsx`
- Create: `apps/web/src/components/storyboard/panels/property-panel.tsx`
- Create: `apps/web/src/components/storyboard/panels/toolbar.tsx`

- [ ] **Step 1: node-list-panel.tsx**

좌측 패널. 노드를 타입별 그룹으로 표시. 클릭 시 캔버스에서 해당 노드 선택.

```tsx
"use client";

import type { Node } from "@xyflow/react";
import type { StoryboardNodeData } from "@repo/types";
import { useEditorStore } from "@/stores/editor-store";

interface NodeListPanelProps {
  nodes: Node[];
  onNodeSelect: (nodeId: string) => void;
}

export function NodeListPanel({ nodes, onNodeSelect }: NodeListPanelProps) {
  const { isNodeListOpen, selectedNodeId } = useEditorStore();

  if (!isNodeListOpen) return null;

  const scenes = nodes.filter((n) => n.type === "scene");
  const events = nodes.filter((n) => n.type === "event");
  const branches = nodes.filter((n) => n.type === "branch");

  const renderGroup = (label: string, color: string, groupNodes: Node[]) => (
    <div className="mb-4">
      <p className="mb-1 px-2 text-xs font-semibold uppercase text-muted-foreground">
        {label} ({groupNodes.length})
      </p>
      {groupNodes.map((node) => {
        const data = node.data as StoryboardNodeData;
        return (
          <button
            key={node.id}
            onClick={() => onNodeSelect(node.id)}
            className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              selectedNodeId === node.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            }`}
          >
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {data.title || "제목 없음"}
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="w-56 shrink-0 overflow-y-auto border-r p-3">
      {renderGroup("씬", "#8b5cf6", scenes)}
      {renderGroup("이벤트", "#10b981", events)}
      {renderGroup("분기", "#f59e0b", branches)}
      {nodes.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-8">
          툴바에서 노드를 추가하세요
        </p>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: property-panel.tsx**

우측 속성 편집 패널. 선택된 노드의 제목, 설명, 태그, 색상 편집. 분기 노드는 선택지 목록 편집.

구현 세부사항:
- `selectedNodeId`로 현재 노드 데이터를 찾기
- 입력 변경 시 `onNodeDataChange(nodeId, newData)` 콜백 호출
- 분기 노드: 선택지 추가/삭제/라벨 수정 UI
- 선택 노드 없으면 "노드를 선택하세요" 메시지

- [ ] **Step 3: toolbar.tsx**

하단 툴바. 노드 추가 버튼 3개 (씬/이벤트/분기).

```tsx
"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToolbarProps {
  onAddNode: (type: "scene" | "event" | "branch") => void;
}

export function Toolbar({ onAddNode }: ToolbarProps) {
  return (
    <div className="flex items-center justify-center gap-2 border-t bg-card px-4 py-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAddNode("scene")}
        className="gap-1"
      >
        <Plus className="h-3 w-3" />
        <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
        씬
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAddNode("event")}
        className="gap-1"
      >
        <Plus className="h-3 w-3" />
        <span className="h-2 w-2 rounded-full bg-[#10b981]" />
        이벤트
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAddNode("branch")}
        className="gap-1"
      >
        <Plus className="h-3 w-3" />
        <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
        분기
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
git commit -m "feat: add panel components (node list, property panel, toolbar)"
```

---

## Task 6: 자동 저장 훅 + Undo/Redo 훅 + 키보드 단축키

**Files:**
- Create: `apps/web/src/components/storyboard/hooks/use-auto-save.ts`
- Create: `apps/web/src/components/storyboard/hooks/use-undo-redo.ts`
- Create: `apps/web/src/components/storyboard/hooks/use-editor-shortcuts.ts`

- [ ] **Step 1: use-auto-save.ts**

```ts
import { useRef, useCallback, useEffect } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useEditorStore } from "@/stores/editor-store";
import { saveStoryboardAction } from "@/actions/save-storyboard-action";

interface UseAutoSaveOptions {
  storyboardId: string;
  userId: string;
  debounceMs?: number;
}

export function useAutoSave({ storyboardId, userId, debounceMs = 2000 }: UseAutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef(0);
  const { setSaveStatus, contentVersion, setContentVersion } = useEditorStore();

  const save = useCallback(
    async (nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }, includeViewport: boolean) => {
      setSaveStatus("saving");
      try {
        const content = {
          version: 1 as const,
          viewport: includeViewport ? viewport : { x: 0, y: 0, zoom: 1 },
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type!,
            position: n.position,
            data: n.data,
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle ?? undefined,
            label: (e.label as string) ?? undefined,
          })),
        };

        // Server Action 호출 (서버에서 apiClient → NestJS API)
        const result = await saveStoryboardAction(storyboardId, userId, content, contentVersion);

        if (result.error) {
          if (result.error === "conflict") {
            setSaveStatus("conflict");
          } else {
            throw new Error(result.error);
          }
        } else if (result.contentVersion !== undefined) {
          setContentVersion(result.contentVersion);
          setSaveStatus("saved");
          retryRef.current = 0;
        }
      } catch {
        // 1회 재시도 (3초 후)
        if (retryRef.current < 1) {
          retryRef.current++;
          setTimeout(() => save(nodes, edges, viewport, includeViewport), 3000);
        } else {
          setSaveStatus("error");
          retryRef.current = 0;
        }
      }
    },
    [storyboardId, userId, contentVersion, setSaveStatus, setContentVersion],
  );

  const debouncedSave = useCallback(
    (nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => save(nodes, edges, viewport, false), debounceMs);
    },
    [save, debounceMs],
  );

  const immediateSave = useCallback(
    (nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      save(nodes, edges, viewport, true);
    },
    [save],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { debouncedSave, immediateSave };
}
```

- [ ] **Step 1b: save-storyboard-action.ts (Server Action)**

`apps/web/src/actions/save-storyboard-action.ts`:
```ts
"use server";

import { apiClient } from "@/lib/api-client";
import type { StoryboardContentV1 } from "@repo/types";

export async function saveStoryboardAction(
  storyboardId: string,
  userId: string,
  content: StoryboardContentV1,
  contentVersion: number,
): Promise<{ contentVersion?: number; error?: string }> {
  try {
    const result = await apiClient<{ contentVersion: number }>(
      `/api/storyboards/${storyboardId}`,
      {
        method: "PATCH",
        body: { content, contentVersion },
        userId,
      },
    );
    return { contentVersion: result.contentVersion };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    if (message.includes("modified") || message.includes("conflict")) {
      return { error: "conflict" };
    }
    return { error: message };
  }
}
```

> `apiClient`는 서버에서만 실행됨 (Server Action 내부). 클라이언트 컴포넌트에서 이 함수를 import하면 Next.js가 자동으로 RPC 호출로 변환.

- [ ] **Step 2: use-undo-redo.ts**

노드/엣지 변경 감지 → 히스토리 push. Undo/Redo 시 노드/엣지 복원.

- [ ] **Step 3: use-editor-shortcuts.ts**

Ctrl+S (즉시 저장), Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo), Ctrl+D (노드 복제).
`useEffect`에서 `keydown` 이벤트 리스너 등록. `e.preventDefault()`로 브라우저 기본 동작 차단.

- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
git commit -m "feat: add auto-save, undo/redo, and keyboard shortcuts hooks"
```

---

## Task 7: 메인 에디터 컴포넌트 조립

**Files:**
- Create: `apps/web/src/components/storyboard/editor.tsx`

- [ ] **Step 1: editor.tsx**

모든 컴포넌트를 조립하는 메인 에디터. "use client" 지시어.

```tsx
"use client";

import { useCallback, useMemo, useRef, useEffect } from "react";
import { ReactFlowProvider, useReactFlow, type Node, type Edge } from "@xyflow/react";
import { Canvas } from "./canvas";
import { NodeListPanel } from "./panels/node-list-panel";
import { PropertyPanel } from "./panels/property-panel";
import { Toolbar } from "./panels/toolbar";
import { useAutoSave } from "./hooks/use-auto-save";
import { useEditorShortcuts } from "./hooks/use-editor-shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { migrateContent } from "@/lib/content-migration";
import type { StoryboardContentV1 } from "@repo/types";

interface StoryboardEditorProps {
  storyboardId: string;
  userId: string;
  initialContent: Record<string, unknown>;
  initialContentVersion: number;
  storyboardName: string;
}

export function StoryboardEditor(props: StoryboardEditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

function EditorInner({
  storyboardId,
  userId,
  initialContent,
  initialContentVersion,
  storyboardName,
}: StoryboardEditorProps) {
  const content = useMemo(() => migrateContent(initialContent), [initialContent]);
  const { setContentVersion, saveStatus } = useEditorStore();

  useEffect(() => {
    setContentVersion(initialContentVersion);
  }, [initialContentVersion, setContentVersion]);

  // ... 노드/엣지 초기화, 추가, 데이터 변경, 자동 저장 연결
  // ... 키보드 단축키 연결
  // ... 레이아웃 조립

  return (
    <div className="flex h-full flex-col">
      {/* 저장 상태 표시 */}
      <div className="flex items-center justify-between border-b px-4 py-1.5">
        <span className="text-sm font-medium">{storyboardName}</span>
        <span className="text-xs text-muted-foreground">
          {saveStatus === "saving" && "저장 중..."}
          {saveStatus === "saved" && "모든 변경사항 저장됨"}
          {saveStatus === "error" && "저장 실패"}
          {saveStatus === "conflict" && "충돌 발생 — 새로고침 필요"}
          {saveStatus === "idle" && ""}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 좌측: 노드 목록 */}
        <NodeListPanel nodes={[]} onNodeSelect={() => {}} />

        {/* 중앙: 캔버스 */}
        <div className="flex-1">
          <Canvas
            initialNodes={content.nodes as Node[]}
            initialEdges={content.edges as Edge[]}
            onNodesChange={() => {}}
            onEdgesChange={() => {}}
          />
        </div>

        {/* 우측: 속성 패널 */}
        <PropertyPanel
          nodes={[]}
          onNodeDataChange={() => {}}
        />
      </div>

      {/* 하단: 툴바 */}
      <Toolbar onAddNode={() => {}} />
    </div>
  );
}
```

> **Note**: 이 Task에서는 레이아웃 조립 + 초기 렌더링만. 연동은 Task 8에서 완성.

- [ ] **Step 2: 빌드 확인 + 커밋**

```bash
git commit -m "feat: add main StoryboardEditor component with layout assembly"
```

---

## Task 8: 에디터 연동 완성 (노드 추가/편집/삭제/복제, 자동 저장, Undo/Redo)

**Files:**
- Modify: `apps/web/src/components/storyboard/editor.tsx`
- Modify: `apps/web/src/components/storyboard/canvas.tsx`

- [ ] **Step 1: editor.tsx 완전 연동**

EditorInner에서:
- `useNodesState`/`useEdgesState`를 editor에서 관리 (canvas에 전달)
- `onAddNode`: 캔버스 중앙에 새 노드 추가 (랜덤 offset)
- `onNodeDataChange`: 노드 data 업데이트 → 자동 저장 트리거
- `useAutoSave` 연결: 노드/엣지 변경 시 `debouncedSave`
- `useEditorShortcuts` 연결: Ctrl+S → `immediateSave`, Ctrl+D → 노드 복제
- `useUndoRedo` 연결
- `beforeunload` 이벤트로 미저장 경고

- [ ] **Step 2: canvas.tsx 리팩터링**

canvas가 부모에서 nodes/edges + handlers를 받는 controlled 패턴이 아닌, `useReactFlow()`로 내부에서 관리. editor와 canvas 간 적절한 인터페이스 확립.

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
git commit -m "feat: wire up editor with auto-save, undo/redo, node CRUD, and shortcuts"
```

---

## Task 9: 스토리보드 페이지에 에디터 연결

**Files:**
- Modify: `apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/[id]/page.tsx`

- [ ] **Step 1: 플레이스홀더 제거, 에디터 연결**

```tsx
import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type { StoryboardDto } from "@repo/types";
import { StoryboardEditor } from "@/components/storyboard/editor";

export default async function StoryboardDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string; id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  let storyboard: StoryboardDto;
  try {
    storyboard = await apiClient<StoryboardDto>(
      `/api/storyboards/${id}`,
      { userId },
    );
  } catch {
    notFound();
  }

  return (
    <div className="h-full">
      <StoryboardEditor
        storyboardId={storyboard.id}
        userId={userId}
        initialContent={storyboard.content}
        initialContentVersion={storyboard.contentVersion}
        storyboardName={storyboard.name}
      />
    </div>
  );
}
```

- [ ] **Step 2: 대시보드 [orgSlug] 레이아웃에서 에디터 페이지일 때 패딩 제거**

스토리보드 에디터는 전체 화면을 써야 하므로, 레이아웃의 `p-6` 패딩을 에디터 페이지에서는 제거하거나, 에디터가 `-m-6`으로 오버라이드.

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
git commit -m "feat: connect StoryboardEditor to storyboard detail page"
```

---

## Task 10: 전체 검증

- [ ] **Step 1: 타입 체크**

```bash
pnpm check-types
```

- [ ] **Step 2: 린트**

```bash
pnpm lint
```

- [ ] **Step 3: 빌드**

```bash
pnpm build
```

- [ ] **Step 4: 수동 확인**

1. 스토리보드 열기 → 빈 캔버스 표시
2. 씬/이벤트/분기 노드 추가
3. 노드 드래그 → 그리드 스냅 확인
4. 노드 간 엣지 연결
5. 노드 선택 → 우측 속성 패널에서 편집
6. Ctrl+Z/Ctrl+Y → Undo/Redo
7. Ctrl+D → 노드 복제
8. 2초 후 자동 저장 → "저장됨" 표시
9. Ctrl+S → 즉시 저장
10. 새로고침 → 저장된 상태 복원

- [ ] **Step 5: 최종 커밋**

```bash
git commit -m "chore: Phase 1 core editor verification complete"
```

---

## 태스크 의존성

```
Task 1 (백엔드) → Task 2 (스토어/마이그레이션) → Task 3 (노드)
                                                     ↓
Task 4 (엣지/캔버스) → Task 5 (패널) → Task 6 (훅) → Task 7 (에디터 조립) → Task 8 (연동) → Task 9 (페이지) → Task 10 (검증)
```

## 의존성 요약

| 패키지 | 용도 |
|--------|------|
| `@xyflow/react` | 노드 기반 캔버스 |
| `zustand` | 에디터 UI 상태 관리 |
| `immer` | Undo/Redo 이뮤터블 스냅샷 |

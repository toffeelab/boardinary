# Editor UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스토리보드 에디터의 인지성·사용성 개선 — 헤더 유틸리티 바, 하단 툴바 단순화, 블루프린트 패널 액션, 템플릿 적용 확인 다이얼로그

**Architecture:** 기존 editor.tsx 헤더 영역에 Undo/Redo + 저장 + 블루프린트 저장 + 레이아웃 드롭다운 배치. 하단 toolbar.tsx는 노드 추가 전용으로 단순화. 블루프린트 패널 항목에 삽입/편집/삭제 버튼 분리. 템플릿 적용 시 기존 콘텐츠 있으면 AlertDialog로 덮어쓰기/추가 배치 선택.

**Tech Stack:** React 19, @xyflow/react, Zustand, shadcn/ui (AlertDialog, Tooltip, DropdownMenu), Tailwind CSS v4, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-31-editor-ux-improvements.md`

---

## File Structure

### New Files

- `apps/web/src/components/storyboard/panels/editor-header.tsx` — 헤더 유틸리티 바 컴포넌트 (Undo/Redo + 저장 + 블루프린트 저장 + 레이아웃)

### Modified Files

- `apps/web/src/components/storyboard/editor.tsx` — 헤더에 EditorHeader 컴포넌트 삽입, handleApplyTemplate 로직 변경
- `apps/web/src/components/storyboard/panels/toolbar.tsx` — 목록닫기/속성닫기/레이아웃 제거, 노드 추가 전용
- `apps/web/src/components/storyboard/panels/blueprint-panel.tsx` — 항목에 삽입/편집/삭제 버튼 추가
- `apps/web/src/components/storyboard/panels/template-browser.tsx` — 기존 콘텐츠 확인 로직 추가

---

### Task 1: shadcn/ui 컴포넌트 설치

**Files:**

- Create: `apps/web/src/components/ui/alert-dialog.tsx` (via shadcn CLI)
- Create: `apps/web/src/components/ui/tooltip.tsx` (via shadcn CLI)

- [ ] **Step 1: AlertDialog 설치**

Run: `cd apps/web && pnpm dlx shadcn@latest add alert-dialog`

- [ ] **Step 2: Tooltip 설치**

Run: `cd apps/web && pnpm dlx shadcn@latest add tooltip`

- [ ] **Step 3: 설치 확인**

Run: `ls apps/web/src/components/ui/alert-dialog.tsx apps/web/src/components/ui/tooltip.tsx`
Expected: 두 파일 모두 존재

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/ui/alert-dialog.tsx apps/web/src/components/ui/tooltip.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add shadcn AlertDialog and Tooltip components"
```

---

### Task 2: 헤더 유틸리티 바 — EditorHeader 컴포넌트

**Files:**

- Create: `apps/web/src/components/storyboard/panels/editor-header.tsx`

- [ ] **Step 1: EditorHeader 컴포넌트 생성**

```tsx
// apps/web/src/components/storyboard/panels/editor-header.tsx
"use client";

import { Undo2, Redo2, Save, Bookmark, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditorStore, type LayoutPreset } from "@/stores/editor-store";

interface EditorHeaderProps {
  title: string;
  hasSelectedNodes: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAsBlueprint: () => void;
}

export function EditorHeader({
  title,
  hasSelectedNodes,
  onUndo,
  onRedo,
  onSave,
  onSaveAsBlueprint,
}: EditorHeaderProps) {
  const { saveStatus, undoStack, redoStack, layoutPreset, setLayoutPreset } =
    useEditorStore();

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-1.5">
        {/* 좌: 제목 + Undo/Redo */}
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          <div className="mx-1 h-4 w-px bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="되돌리기"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>되돌리기 (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="다시 실행"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>다시 실행 (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        {/* 중: 저장 상태 + 저장 + 블루프린트 저장 */}
        <div className="flex items-center gap-2">
          <SaveStatusIndicator status={saveStatus} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSave}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span className="hidden md:inline">저장</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>저장 (Ctrl+S)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSaveAsBlueprint}
                disabled={!hasSelectedNodes}
                className="gap-1.5 text-primary hover:text-primary"
              >
                <Bookmark className="h-4 w-4" />
                <span className="hidden md:inline">블루프린트 저장</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasSelectedNodes
                ? "블루프린트로 저장 (Ctrl+Shift+S)"
                : "노드를 먼저 선택하세요"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* 우: 레이아웃 */}
        <div className="flex items-center">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <LayoutGrid className="h-4 w-4" />
                    <span className="hidden md:inline">레이아웃</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>패널 레이아웃</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={layoutPreset}
                onValueChange={(v) => setLayoutPreset(v as LayoutPreset)}
              >
                <DropdownMenuRadioItem value="default">
                  기본 (목록 좌 / 속성 우)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="reversed">
                  역배치 (속성 좌 / 목록 우)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="property-only">
                  속성만 (목록 없음)
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SaveStatusIndicator({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error" | "conflict";
}) {
  switch (status) {
    case "saving":
      return <span className="text-xs text-muted-foreground">저장 중...</span>;
    case "saved":
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          저장됨
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          저장 실패
        </span>
      );
    case "conflict":
      return (
        <span className="flex items-center gap-1 text-xs text-amber-500">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          충돌
        </span>
      );
    default:
      return null;
  }
}
```

- [ ] **Step 2: 빌드 확인**

Run: `pnpm --filter web check-types`
Expected: 성공 (icon-sm size가 없으면 `size="sm"` + padding 조정으로 대체)

Note: `size="icon-sm"` 이 shadcn Button에 없을 수 있음. 해당 경우 기존 `size="sm"` + `className="h-8 w-8 p-0"` 으로 대체.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/storyboard/panels/editor-header.tsx
git commit -m "feat: add EditorHeader component with undo/redo, save, blueprint save, layout"
```

---

### Task 3: 하단 툴바 단순화

**Files:**

- Modify: `apps/web/src/components/storyboard/panels/toolbar.tsx`

- [ ] **Step 1: toolbar.tsx에서 패널 토글/레이아웃 제거**

`toolbar.tsx`를 다음으로 교체 — 노드 추가 버튼 + 템플릿 버튼만 유지:

```tsx
// apps/web/src/components/storyboard/panels/toolbar.tsx
"use client";

import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

type StoryboardNodeType =
  | "scene"
  | "event"
  | "branch"
  | "dialogue"
  | "condition"
  | "note";

interface ToolbarProps {
  onAddNode: (type: StoryboardNodeType) => void;
  onOpenTemplates?: () => void;
}

const ADD_BUTTONS: {
  type: StoryboardNodeType;
  label: string;
  color: string;
}[] = [
  { type: "scene", label: "+ 씬", color: "#8b5cf6" },
  { type: "event", label: "+ 이벤트", color: "#10b981" },
  { type: "branch", label: "+ 분기", color: "#f59e0b" },
  { type: "dialogue", label: "+ 대사", color: "#3b82f6" },
  { type: "condition", label: "+ 조건", color: "#ef4444" },
  { type: "note", label: "+ 메모", color: "#6b7280" },
];

export function Toolbar({ onAddNode, onOpenTemplates }: ToolbarProps) {
  return (
    <div className="flex items-center justify-center gap-1.5 border-t border-border bg-card px-4 py-2">
      {ADD_BUTTONS.map(({ type, label, color }) => (
        <Button
          key={type}
          type="button"
          variant="outline"
          size="sm"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/boardinary-node", type);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => onAddNode(type)}
          className="gap-1.5"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {label}
        </Button>
      ))}

      {onOpenTemplates && (
        <>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenTemplates}
            className="gap-1.5"
          >
            <ClipboardList className="h-4 w-4" />
            템플릿
          </Button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: editor.tsx에 EditorHeader 통합**

editor.tsx에서:

1. `import { EditorHeader } from "./panels/editor-header"` 추가
2. 기존 헤더 영역(스토리보드 제목 표시 부분)을 `<EditorHeader>` 로 교체
3. props 연결:
   - `title`: `storyboardName` 또는 blueprint mode일 때 `blueprintName`
   - `hasSelectedNodes`: React Flow의 선택된 노드 수 > 0
   - `onUndo`: 기존 `handleUndo`
   - `onRedo`: 기존 `handleRedo`
   - `onSave`: `immediateSave`
   - `onSaveAsBlueprint`: `handleSaveAsBlueprint`

기존 toolbar.tsx에 전달하던 `isNodeListOpen`, `toggleNodeList` 등의 props는 이제 불필요하므로 제거.

- [ ] **Step 3: 빌드 + 테스트**

Run: `pnpm --filter web check-types && pnpm --filter web test`
Expected: 타입 체크 통과, 39 테스트 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/storyboard/panels/toolbar.tsx apps/web/src/components/storyboard/editor.tsx
git commit -m "feat: move utils to header bar, simplify bottom toolbar to add-only"
```

---

### Task 4: 블루프린트 패널 — 삽입/편집/삭제 버튼

**Files:**

- Modify: `apps/web/src/components/storyboard/panels/blueprint-panel.tsx`

- [ ] **Step 1: 항목 카드 레이아웃 변경**

blueprint-panel.tsx의 항목 렌더링 부분(기존 `blueprints.map` 블록)을 다음으로 교체:

```tsx
// blueprint-panel.tsx 내 blueprints.map 블록 교체
import { Download, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

// BlueprintPanelProps에 orgSlug 추가
interface BlueprintPanelProps {
  onInsert: (content: { nodes: Node[]; edges: Edge[] }) => void;
  orgId?: string;
  orgSlug?: string;
}

// 컴포넌트 내부:
const router = useRouter();

// return 부분에서 blueprints.map을:
{
  blueprints.map((bp) => (
    <div key={bp.id} className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium text-foreground">
          {bp.name}
        </span>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {typeLabel(bp.type)}
        </Badge>
      </div>
      {bp.description && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {bp.description}
        </p>
      )}
      <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 gap-1"
          onClick={() => void handleInsert(bp.id)}
          disabled={isPending}
        >
          <Download className="h-3.5 w-3.5" />
          삽입
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1"
          onClick={() =>
            router.push(`/dashboard/${orgSlug}/blueprints/${bp.id}/edit`)
          }
          disabled={!orgSlug}
        >
          <Pencil className="h-3.5 w-3.5" />
          편집
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-9 p-0 text-destructive hover:text-destructive"
          onClick={() => handleDelete(bp.id)}
          disabled={isPending}
          aria-label="삭제"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  ));
}
```

- [ ] **Step 2: editor.tsx에서 orgSlug prop 전달**

NodeListPanel → BlueprintPanel으로 `orgSlug`를 전달. editor.tsx의 props 또는 URL 파라미터에서 orgSlug를 추출하여 전달.

- [ ] **Step 3: 빌드 + 테스트**

Run: `pnpm --filter web check-types && pnpm --filter web test`
Expected: 타입 체크 통과, 39 테스트 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/storyboard/panels/blueprint-panel.tsx apps/web/src/components/storyboard/panels/node-list-panel.tsx apps/web/src/components/storyboard/editor.tsx
git commit -m "feat: add insert/edit/delete action buttons to blueprint panel items"
```

---

### Task 5: 템플릿 적용 확인 다이얼로그

**Files:**

- Modify: `apps/web/src/components/storyboard/panels/template-browser.tsx`
- Modify: `apps/web/src/components/storyboard/editor.tsx`

- [ ] **Step 1: template-browser.tsx에 nodeCount prop + 확인 UI 추가**

TemplateBrowserProps에 `currentNodeCount: number` 추가. 적용 버튼 클릭 시 노드가 있으면 AlertDialog를 표시:

```tsx
// template-browser.tsx 수정
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TemplateBrowserProps {
  open: boolean;
  onClose: () => void;
  onApply: (template: StoryboardTemplate, mode: "replace" | "append") => void;
  currentNodeCount: number;
  currentEdgeCount: number;
}

// 컴포넌트 내부에 상태 추가:
const [showConfirm, setShowConfirm] = useState(false);

function handleApply() {
  if (!selectedTemplate) return;
  if (currentNodeCount === 0) {
    onApply(selectedTemplate, "replace");
    setSelectedId(null);
  } else {
    setShowConfirm(true);
  }
}

function handleConfirmReplace() {
  if (selectedTemplate) {
    onApply(selectedTemplate, "replace");
    setSelectedId(null);
    setShowConfirm(false);
  }
}

function handleConfirmAppend() {
  if (selectedTemplate) {
    onApply(selectedTemplate, "append");
    setSelectedId(null);
    setShowConfirm(false);
  }
}

// JSX 안에 AlertDialog 추가 (Dialog 닫힌 뒤):
<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>캔버스에 기존 요소가 있습니다</AlertDialogTitle>
      <AlertDialogDescription>
        현재 노드 {currentNodeCount}개, 엣지 {currentEdgeCount}개가 있습니다.
        템플릿을 어떻게 적용할까요?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex gap-2 sm:flex-row">
      <AlertDialogCancel>취소</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmAppend} className="bg-primary">
        추가 배치
      </AlertDialogAction>
      <AlertDialogAction
        onClick={handleConfirmReplace}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        덮어쓰기
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>;
```

- [ ] **Step 2: editor.tsx — handleApplyTemplate에 mode 파라미터 추가**

```ts
// editor.tsx 내 handleApplyTemplate 수정
function handleApplyTemplate(template: StoryboardTemplate, mode: "replace" | "append") {
  pushSnapshot();

  const clonedNodes = /* 기존 노드 클론 로직 */;
  const clonedEdges = /* 기존 엣지 클론 로직 */;

  if (mode === "replace") {
    // 기존 전부 삭제 후 교체
    setNodes(clonedNodes);
    setEdges(clonedEdges);
  } else {
    // 기존 노드 바운딩 박스 우측에 오프셋
    const existingNodes = nodesRef.current;
    const maxX = existingNodes.length > 0
      ? Math.max(...existingNodes.map(n => n.position.x + (n.measured?.width ?? 200)))
      : 0;
    const offsetX = maxX + 300;

    const offsetNodes = clonedNodes.map(n => ({
      ...n,
      position: { x: n.position.x + offsetX, y: n.position.y },
    }));

    setNodes(nds => [...nds, ...offsetNodes]);
    setEdges(eds => [...eds, ...clonedEdges]);
  }

  markDirtyAndSave();
  setIsTemplateBrowserOpen(false);
}
```

TemplateBrowser 호출부에 `currentNodeCount={nodes.length}` 와 `currentEdgeCount={edges.length}` 전달.

- [ ] **Step 3: 빌드 + 테스트**

Run: `pnpm --filter web check-types && pnpm --filter web test`
Expected: 타입 체크 통과, 39 테스트 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/storyboard/panels/template-browser.tsx apps/web/src/components/storyboard/editor.tsx
git commit -m "feat: add template apply confirmation dialog with replace/append options"
```

---

### Task 6: 전체 검증

- [ ] **Step 1: 타입 체크**

Run: `pnpm --filter web check-types`
Expected: 성공

- [ ] **Step 2: 테스트**

Run: `pnpm --filter web test`
Expected: 39+ 테스트 통과

- [ ] **Step 3: E2E 확인**

Docker + API + Web dev 서버 실행 후 Chrome DevTools MCP로:

1. 에디터 진입 → 헤더에 Undo/Redo, 저장, 블루프린트 저장, 레이아웃 버튼 확인
2. 하단바에 노드 추가 + 템플릿만 있는지 확인
3. 노드 선택 → Ctrl+Shift+S → 다이얼로그 확인
4. 블루프린트 탭 → 삽입/편집/삭제 버튼 확인
5. 템플릿 적용 → 확인 다이얼로그(덮어쓰기/추가 배치) 확인

- [ ] **Step 4: 최종 커밋 (필요 시)**

```bash
git add -A
git commit -m "fix: address build/type issues from editor UX improvements"
```

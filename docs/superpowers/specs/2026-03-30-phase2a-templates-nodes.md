# Phase 2a: 장르 템플릿 + 커스텀 노드 타입

## 개요

에디터에 대사/조건/메모 노드 3종을 추가하고, RPG/액션/퍼즐 장르 템플릿 3종을 코드에 내장한다. 스토리보드 생성 시 + 에디터 내에서 템플릿을 적용할 수 있다.

## 새 노드 타입 3종

| 타입 | 색상 | 용도 | 전용 속성 |
|------|------|------|----------|
| **대사 (dialogue)** | Blue (#3b82f6) | 캐릭터 대화/나레이션 | speaker, dialogueText |
| **조건 (condition)** | Red (#ef4444) | 조건 분기 (아이템/레벨 체크 등) | conditionExpr, true/false 핸들 고정 |
| **메모 (note)** | Gray (#6b7280) | 기획자 메모/주석 | 핸들 없음 (연결 불가) |

기존 노드(씬/이벤트/분기/그룹) + 새 3종 = **7종 총합**

### 노드 상세

**대사 (dialogue):**
- 좌측 target 핸들, 우측 source 핸들 (씬과 동일)
- 화자(speaker) 표시 + 대사 텍스트 미리보기
- 속성 패널: speaker 입력, dialogueText textarea, 태그, 색상

**조건 (condition):**
- 좌측 target 핸들
- 우측 source 핸들 2개 고정: `true` (Green), `false` (Red)
- 분기와 유사하지만 선택지가 아닌 참/거짓
- 속성 패널: conditionExpr 입력 (텍스트), 태그, 색상

**메모 (note):**
- 핸들 없음 — 엣지 연결 불가
- 스티커 노트 스타일 (점선 테두리, 반투명)
- 속성 패널: 내용 텍스트만

## 타입 변경

```ts
// StoryboardNode.type 확장
type: "scene" | "event" | "branch" | "group" | "dialogue" | "condition" | "note";

// StoryboardNodeData 확장 (기존 필드 + 새 필드)
interface StoryboardNodeData {
  title: string;
  description?: string;
  tags?: string[];
  color?: string;
  choices?: Array<{ id: string; label: string }>;  // branch
  speaker?: string;       // dialogue
  dialogueText?: string;  // dialogue
  conditionExpr?: string; // condition
}
```

## 코드 필수 업데이트

1. **`content-migration.ts`의 `VALID_NODE_TYPES`** — `dialogue`, `condition`, `note` 추가. 안 하면 로드 시 새 노드가 삭제됨
2. **`use-auto-save.ts`의 `toContentV1` 타입 캐스트** — 새 노드 타입 포함하도록 업데이트. 안 하면 저장 시 유실
3. **`node-types.ts`** — 새 3종 노드 컴포넌트 등록
4. **툴바** — 새 노드 추가 버튼 3개 (대사/조건/메모)

## 장르 템플릿 (코드 내장, 3종)

### 저장 방식
- 코드에 JSON으로 내장 (`apps/web/src/components/storyboard/templates/`)
- `StoryboardContentV1` 형태
- DB 변경 없음
- Phase 2b에서 사용자 템플릿 추가 시 `templates` DB 테이블 도입

### 템플릿 구성

**RPG 템플릿:**
- 씬(시작 마을) → 대사(NPC 대화) → 분기(퀘스트 수락?) → 씬(던전) → 이벤트(보스 전투) → 분기(승리?) → 씬(엔딩)
- 메모: "보상 아이템을 추가하세요"
- 노드 7개 + 엣지 6개

**액션/FPS 템플릿:**
- 씬(브리핑) → 이벤트(미션 시작) → 조건(목표 달성?) → 분기(성공/실패) → 씬(결과)
- 메모: "웨이포인트를 씬 사이에 추가하세요"
- 노드 6개 + 엣지 5개

**퍼즐 템플릿:**
- 씬(퍼즐 소개) → 조건(힌트 사용?) → 이벤트(퍼즐 시도) → 조건(정답?) → 분기(다음/재시도) → 씬(클리어)
- 메모: "난이도별 분기를 추가하세요"
- 노드 7개 + 엣지 6개

### 템플릿 인터페이스

```ts
interface StoryboardTemplate {
  id: string;
  name: string;
  genre: string;
  description: string;
  nodeCount: number;
  content: StoryboardContentV1;
}
```

## 템플릿 적용 UX

### 스토리보드 생성 시
- 기존 "새 스토리보드" 폼에 **템플릿 선택 단계** 추가
- 4가지 옵션: "빈 캔버스" + RPG + 액션/FPS + 퍼즐
- 카드 형태로 미리보기 (이름, 설명, 노드 수)
- 선택한 템플릿의 content를 스토리보드 생성 시 초기값으로 설정

### 에디터 내
- 툴바에 **"템플릿"** 버튼 추가
- 클릭 → 모달에서 템플릿 선택
- 선택한 템플릿의 노드/엣지를 현재 캔버스의 빈 영역에 추가 (기존 노드 유지)
- 추가 시 노드 위치를 오프셋하여 기존 노드와 겹치지 않도록 처리
- Undo/Redo에 포함 (단일 스냅샷)

## 파일 구조

### 신규 파일
```
apps/web/src/components/storyboard/
├── nodes/
│   ├── dialogue-node.tsx       # 대사 노드
│   ├── condition-node.tsx      # 조건 노드
│   └── note-node.tsx           # 메모 노드
├── panels/
│   └── template-browser.tsx    # 템플릿 선택 모달
└── templates/
    ├── index.ts                # 템플릿 레지스트리 + 인터페이스
    ├── rpg.ts                  # RPG 템플릿
    ├── action-fps.ts           # 액션/FPS 템플릿
    └── puzzle.ts               # 퍼즐 템플릿
```

### 수정 파일
```
packages/types/src/storyboards.ts
  → 노드 type union + StoryboardNodeData 필드 추가

apps/web/src/components/storyboard/nodes/node-types.ts
  → dialogue, condition, note 등록

apps/web/src/components/storyboard/panels/toolbar.tsx
  → 대사/조건/메모 추가 버튼, 템플릿 버튼

apps/web/src/components/storyboard/panels/property-panel.tsx
  → dialogue/condition/note 타입별 속성 편집 UI

apps/web/src/components/storyboard/editor.tsx
  → 새 노드 타입 처리, 템플릿 적용 로직

apps/web/src/lib/content-migration.ts
  → VALID_NODE_TYPES에 dialogue/condition/note 추가

apps/web/src/components/storyboard/hooks/use-auto-save.ts
  → toContentV1 타입 캐스트 업데이트

apps/web/src/app/dashboard/[orgSlug]/projects/[slug]/storyboards/new/page.tsx
  → 템플릿 선택 UI 추가
```

## API 변경

없음. content jsonb에 새 노드 타입이 저장. 스토리보드 생성 시 `content` 초기값만 프론트에서 설정.

## Content 스키마 버전

`version: 1` 유지. 새 필드/노드 타입은 모두 optional이므로 하위 호환.

## Phase 2a 범위 외

| 항목 | 이연 시점 |
|------|----------|
| 사용자 커스텀 템플릿 저장 | Phase 2b |
| 컴포넌트 라이브러리 (노드 그룹 재사용) | Phase 2b |
| 공유 범위 (개인/프로젝트/조직) | Phase 2b |
| 리치 텍스트 에디터 (대사 마크다운) | Phase 2+ |
| 템플릿 갤러리 (커뮤니티 공유) | 추후 |

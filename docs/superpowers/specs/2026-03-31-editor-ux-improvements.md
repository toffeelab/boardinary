# 에디터 UX 개선 스펙

**Goal:** 스토리보드 에디터의 인지성과 사용성 개선 — 4가지 UX 이슈 해결

**Scope:** `apps/web/src/components/storyboard/` 내 기존 컴포넌트 수정 (새 파일 최소)

---

## 이슈 1: 헤더 유틸리티 바 재구성

### 문제

- 하단 툴바 끝의 "기본" 버튼이 레이아웃 변경 기능인지 인지 불가
- Undo/Redo가 단축키로만 존재하여 유저가 기능 자체를 모름
- 저장 버튼 없음, 블루프린트 저장 진입점 없음

### 설계

**헤더 바 3영역 구조:**

| 영역     | 내용                                              |
| -------- | ------------------------------------------------- |
| **좌측** | 스토리보드 제목 + 구분선 + Undo/Redo 아이콘 버튼  |
| **중앙** | 저장 상태 표시 + 저장 버튼 + 블루프린트 저장 버튼 |
| **우측** | 레이아웃 드롭다운 (라벨: "레이아웃")              |

**Undo/Redo 버튼:**

- 아이콘: `Undo2`, `Redo2` (lucide)
- Undo 비활성 조건: undoStack이 비어있을 때
- Redo 비활성 조건: redoStack이 비어있을 때
- 툴팁: "되돌리기 (Ctrl+Z)" / "다시 실행 (Ctrl+Y)"

**저장 버튼:**

- 아이콘: `Save` (lucide) + "저장" 텍스트
- 클릭 시 `immediateSave()` 호출
- 저장 상태 indicator: "저장됨" (green dot) / "저장 중..." / "미저장" (amber dot)
- 툴팁: "저장 (Ctrl+S)"

**블루프린트 저장 버튼:**

- 아이콘: `Bookmark` (lucide) + "블루프린트 저장" 텍스트
- 노드 미선택 시 disabled + 툴팁 "노드를 먼저 선택하세요"
- 노드 선택 시 활성화, 클릭 시 SaveBlueprintDialog 오픈
- 약간의 보라색 강조 (primary accent)
- 툴팁: "블루프린트로 저장 (Ctrl+Shift+S)"

**레이아웃 드롭다운:**

- 라벨: "기본" → **"레이아웃"** 으로 변경
- 아이콘: `LayoutGrid` 유지
- 옵션 텍스트 유지 (기본/역배치/속성만)

**하단 툴바에서 제거:**

- "목록 닫기" / "속성 닫기" 버튼 제거 (패널 자체의 닫기 버튼으로 충분)
- 레이아웃 드롭다운 제거 (헤더로 이동)
- 하단 = 노드 추가 버튼 + 템플릿 버튼만 유지

### 수정 파일

- `editor.tsx` — 헤더 영역에 유틸리티 버튼 추가
- `panels/toolbar.tsx` — 레이아웃/목록닫기/속성닫기 제거, 노드 추가 전용으로 단순화

---

## 이슈 2: 템플릿 적용 — 기존 콘텐츠 처리

### 문제

- 기존 노드가 있는 캔버스에 템플릿 적용 시 노드가 겹쳐서 에러/혼란 발생
- 교체 vs 추가 선택지 없음

### 설계

**캔버스 상태 분기:**

1. **캔버스 비어있음** (노드 0개) → 바로 적용 (현재와 동일)
2. **캔버스에 노드 있음** → 확인 다이얼로그 표시

**확인 다이얼로그:**

- 제목: "캔버스에 기존 요소가 있습니다"
- 부제: "현재 노드 {N}개, 엣지 {M}개"
- 버튼 3개:
  - **"덮어쓰기"** (destructive, red) — 기존 노드/엣지 전부 삭제 후 템플릿 적용. Undo 스냅샷 저장 후 실행.
  - **"추가 배치"** (primary, purple) — 기존 노드 바운딩 박스 우측 끝 + 300px 오프셋에 템플릿 노드 배치. 기존 내용 유지.
  - **"취소"** (secondary) — 다이얼로그 닫기, 변경 없음

**추가 배치 오프셋 계산:**

```
maxX = Math.max(...existingNodes.map(n => n.position.x + (n.measured?.width ?? 200)))
templateOffsetX = maxX + 300
```

### 수정 파일

- `editor.tsx` — `handleApplyTemplate` 로직 변경
- `panels/template-browser.tsx` — 선택/적용 시 노드 유무에 따라 확인 다이얼로그 트리거
- 새 파일: `panels/template-confirm-dialog.tsx` (또는 template-browser 내 인라인 처리)

---

## 이슈 3: 블루프린트 패널 — 항목별 액션 명확화

### 문제

- 블루프린트 항목 클릭 → 바로 삽입되어 실수 유발
- 편집 진입점 없음 (편집 페이지는 존재하지만 갈 방법 없음)

### 설계

**항목 카드 레이아웃 변경:**

- 상단: 이름 + 타입 뱃지 + 노드 수 표시
- 하단 (구분선 아래): 버튼 3개

| 버튼     | 아이콘     | 동작                                                        |
| -------- | ---------- | ----------------------------------------------------------- |
| **삽입** | `Download` | 블루프린트 content를 뷰포트 중앙에 배치 (기존 onInsert)     |
| **편집** | `Pencil`   | `/dashboard/[orgSlug]/blueprints/[id]/edit` 페이지로 라우팅 |
| **삭제** | `Trash2`   | 확인 후 삭제 + 목록 리프레시                                |

**삽입 버튼**: primary accent (보라색 배경), flex:1
**편집 버튼**: secondary (기본 배경), flex:1
**삭제 버튼**: destructive icon only, 고정 너비

**노드 수 표시:**

- 타입 뱃지 옆에 "노드 {N}개" 표시
- content에서 nodes 배열 길이로 계산 (BlueprintMetaDto에 content 없으므로 getBlueprintById 호출 또는 content 메타 추가 필요)
- 간단한 방법: list API에서 contentVersion만 표시하거나, content 없이 노드 수를 별도 필드로 추가
- **MVP**: 노드 수 표시 생략, 타입 뱃지 + 설명만으로 충분. 향후 개선.

### 수정 파일

- `panels/blueprint-panel.tsx` — 항목 카드 레이아웃 변경, 버튼 3개 추가

---

## 이슈 4: Undo/Redo 가시성

이슈 1에서 해결됨 — 헤더에 Undo/Redo 아이콘 버튼 추가.

추가 고려사항:

- 버튼 비활성/활성 상태로 "되돌릴 수 있는지" 시각적 피드백 제공
- 툴팁에 단축키 표시하여 학습 유도

---

## 영향 범위

| 파일                          | 변경 내용                                         |
| ----------------------------- | ------------------------------------------------- |
| `editor.tsx`                  | 헤더 유틸리티 바 추가, 템플릿 적용 로직 변경      |
| `panels/toolbar.tsx`          | 레이아웃/패널 닫기 버튼 제거, 노드 추가 전용      |
| `panels/template-browser.tsx` | 기존 콘텐츠 확인 다이얼로그 트리거                |
| `panels/blueprint-panel.tsx`  | 항목 카드에 삽입/편집/삭제 버튼 추가              |
| `stores/editor-store.ts`      | undoStack/redoStack length 셀렉터 추가 (optional) |

## 컨벤션 준수 사항

### FRONTEND.md 반응형

- 헤더 유틸리티 바: 모바일(375px)에서 버튼 텍스트 숨김 → 아이콘만 표시. `sm:` 이상에서 텍스트 노출
- 블루프린트 저장 버튼: 모바일에서 `📌` 아이콘만, `md:` 이상에서 "블루프린트 저장" 텍스트 노출
- 레이아웃 드롭다운: 모바일에서 아이콘만, `md:` 이상에서 "레이아웃" 텍스트 노출
- 터치 타겟: 모든 버튼 최소 44x44px (p-2 이상)

### shadcn/ui 컴포넌트

- 템플릿 확인 다이얼로그: `AlertDialog` 사용 (파괴적 액션 "덮어쓰기" 포함)
- 블루프린트 삭제 확인: `AlertDialog` 사용
- 툴팁: `Tooltip` + `TooltipTrigger` + `TooltipContent` (단축키 표시)
- 드롭다운: 기존 `DropdownMenu` 패턴 유지
- 저장 상태 표시: 커스텀 (dot + 텍스트)

### ARCHITECTURE.md 불변 조건

- `any` 금지 → `unknown` 사용
- `console.log` 금지
- 불필요한 `'use client'` 금지 — 새로 추가하는 컴포넌트는 Server Component 기본, 필요한 곳만 `'use client'`
- 기존 editor.tsx는 이미 Client Component (React Flow 사용)

## 구현 우선순위

1. 헤더 유틸리티 바 (Undo/Redo + 저장 + 블루프린트 저장 + 레이아웃)
2. 하단 툴바 단순화
3. 블루프린트 패널 항목 액션
4. 템플릿 적용 확인 다이얼로그

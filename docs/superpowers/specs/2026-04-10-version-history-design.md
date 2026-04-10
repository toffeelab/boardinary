# Version History 설계 문서

**날짜**: 2026-04-10  
**기능**: 스토리보드 버전 관리 및 변경 이력  
**관련 명세서**: `docs/product-specs/기능명세서_2026-03-25.md` §2

---

## 목표

스토리보드의 변경 이력을 자동/수동으로 저장하고, 과거 버전을 미리보기한 뒤 전체 복원할 수 있는 시스템을 구축한다.

---

## 결정 사항

| 항목        | 결정                                                      | 이유                                                              |
| ----------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| 저장 방식   | 전체 JSON 스냅샷                                          | 복원 O(1), diff 체인 의존성 없음, 스토리보드 content는 수 MB 이하 |
| 자동 트리거 | `flushStoryboard()` 내부에서 서버가 판단                  | 클라이언트 트리거는 race condition 위험                           |
| 자동 간격   | `contentVersion % 10` (약 5분)                            | 기존 auto-save(30초 디바운스) 편승                                |
| 수동 저장   | 이름 붙인 체크포인트                                      | 중요 시점 명시 가능                                               |
| 복원 방식   | 미리보기(읽기 전용) → 확인 → 전체 롤백                    | 실수 방지                                                         |
| 보관 정책   | 최대 50개, 초과 시 오래된 자동 버전부터 삭제, 수동은 보호 | 앱 레이어 처리                                                    |
| 아키텍처    | NestJS REST API (기존 Comments/Blueprints 패턴)           | 일관성, 권한 체크                                                 |

---

## DB 스키마

`packages/db/src/schema.ts`에 추가:

```ts
export const storyboardVersions = pgTable(
  "storyboard_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    storyboardId: text("storyboard_id")
      .notNull()
      .references(() => storyboards.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    label: text("label"), // null=자동, not null=수동 체크포인트
    content: jsonb("content").notNull(), // 전체 스냅샷
    contentVersion: integer("content_version").notNull(),
    restoredFromId: text("restored_from_id"), // 복원으로 생성된 경우 원본 버전 참조
    metadata: jsonb("metadata"), // { added, removed, modified }
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_storyboard_versions_content_version").on(
      table.storyboardId,
      table.contentVersion,
    ),
    index("idx_storyboard_versions_list").on(
      table.storyboardId,
      table.createdAt,
    ),
    // 보관 정책 삭제용 부분 인덱스 (raw SQL로 마이그레이션에서 처리)
    // CREATE INDEX idx_sv_auto_retention ON storyboard_versions (storyboard_id, created_at ASC)
    // WHERE label IS NULL;
  ],
);
```

### 제약조건

- `UNIQUE(storyboardId, contentVersion)` — 동시성 환경에서 동일 버전 중복 스냅샷 방지
- `label`: DTO에서 `@MaxLength(100)` 적용
- `restoredFromId`: 자기 참조 FK (`ON DELETE SET NULL`)는 마이그레이션에서 별도 처리

---

## API 설계

### 엔드포인트

| Method   | Path                                           | 응답                           | 설명                                |
| -------- | ---------------------------------------------- | ------------------------------ | ----------------------------------- |
| `GET`    | `/storyboards/:id/versions`                    | `200` 버전 목록 (content 제외) | 타임라인용 메타                     |
| `GET`    | `/storyboards/:id/versions/:versionId`         | `200` 단건 (content 포함)      | 미리보기용                          |
| `POST`   | `/storyboards/:id/versions`                    | `201` 생성된 버전              | 수동 체크포인트                     |
| `POST`   | `/storyboards/:id/versions/:versionId/restore` | `201` 새 버전                  | 복원 실행                           |
| `DELETE` | `/storyboards/:id/versions/:versionId`         | `204`                          | 수동 버전만 삭제 가능, 자동은 `422` |

### 자동 버전 생성 흐름

```
CollaborationService.flushStoryboard()
  → contentVersion++ 후 DB UPDATE
  → contentVersion % 10 === 0?
      YES → VersionsService.createAutoSnapshot(storyboardId, content, contentVersion)
           → 자동 버전 count > 50? → 가장 오래된 자동 버전 삭제 (단일 DELETE 쿼리)
```

### 복원 흐름

```
POST /storyboards/:id/versions/:versionId/restore
  1. pg_advisory_xact_lock(storyboardId) — 동시 복원 방지
  2. storyboard_versions에서 content 조회
  3. storyboards UPDATE (content, contentVersion++)
  4. storyboard_versions INSERT (label: null, restoredFromId: versionId, metadata 계산)
  5. redis.clearRoom(storyboardId)
  6. CollaborationService.initRoomFromDb(storyboardId, forceReload: true)
  7. EventEmitter.emit('version.restored', { storyboardId, content, contentVersion, restoredBy })
  → 201 + 새 버전 객체 반환
```

### Socket.io 이벤트

```
// collaboration.gateway.ts
@OnEvent('version.restored')
handleVersionRestored(payload) {
  this.server.to(payload.storyboardId).emit('room:restored', {
    content: payload.content,
    contentVersion: payload.contentVersion,
    restoredBy: payload.restoredBy,
  });
}
// 요청자 포함 방 전체 브로드캐스트
```

### 파일 구조 (API)

```
apps/api/src/versions/
├── versions.module.ts
├── versions.controller.ts
├── versions.service.ts
├── dto/
│   ├── create-checkpoint.dto.ts    // { label: string @MaxLength(100) }
│   └── version-response.dto.ts
└── __tests__/
    └── versions.service.test.ts
```

---

## 웹 UI 설계

### 컴포넌트 구조

```
apps/web/src/components/storyboard/versions/
├── useVersions.ts             ← fetch + Socket room:restored 구독
├── VersionPanel.tsx            ← 우측 슬라이드인 패널 (VersionItem 인라인 포함)
├── VersionPreviewModal.tsx     ← 독립 ReactFlowProvider + 읽기 전용
└── SaveCheckpointDialog.tsx    ← 수동 체크포인트 이름 입력
```

### UI 플로우

```
툴바 "히스토리" 버튼 (H 단축키, storyboard 모드만)
  → activeSidePanel = "versions" (CommentPanel 자동 닫힘)
  → VersionPanel 슬라이드인 (우측)
      - 자동 버전: "2026-04-10 14:32 · 자동저장"
      - 수동 버전: "★ v2.0 퀘스트 분기 확정"
      - "체크포인트 저장" 버튼
  → 버전 클릭 → VersionPreviewModal
      - <ReactFlowProvider key={previewVersionId}>
          <ReactFlow nodesDraggable={false} nodesConnectable={false}
                     elementsSelectable={false} panOnDrag zoomOnScroll fitView />
        </ReactFlowProvider>
      - "이 버전으로 복원" 버튼 → Alert 확인 → POST restore
  → room:restored 수신 → 에디터 content 교체 + clearHistory() + toast + 패널 닫힘
```

### 기존 파일 수정

| 파일                      | 변경                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `editor-store.ts`         | `activeSidePanel: "comments" \| "versions" \| null` 추가 (기존 boolean 플래그 통합)     |
| `toolbar.tsx`             | 히스토리 버튼 추가 (blueprint 모드 시 숨김)                                             |
| `editor.tsx`              | `useVersions` 연결, `VersionPanel` / `VersionPreviewModal` 렌더링, `room:restored` 처리 |
| `use-editor-shortcuts.ts` | `H` 키 → 히스토리 토글 (INPUT/TEXTAREA/contentEditable 편집 중 차단)                    |
| `lib/content-utils.ts`    | `contentToReactFlow` 함수 추출 (editor.tsx에서 이동)                                    |

### room:restored 처리

```ts
socket.on("room:restored", (payload) => {
  const { nodes, edges } = contentToReactFlow(payload.content); // lib/content-utils.ts
  isRemoteUpdateRef.current = true;
  setNodes(nodes);
  setEdges(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  isRemoteUpdateRef.current = false;
  clearHistory(); // Undo 스택 초기화
  toast.success(`버전이 복원되었습니다.`);
  setActiveSidePanel(null);
});
```

---

## 테스트 전략

- `versions.service.test.ts`: 자동 버전 생성, 보관 정책 삭제, 복원 로직 단위 테스트 (Docker PG)
- `useVersions.test.ts`: 훅 단위 테스트 (Vitest + MSW)
- 수동 E2E: 버전 생성 → 편집 → 미리보기 → 복원 → 협업자 화면 동기화 확인

---

## 명세서 커버리지

| 명세서 항목                    | 구현 여부                                |
| ------------------------------ | ---------------------------------------- |
| 2.1.1 버전 생성 트리거         | ✅ flushStoryboard % 10 자동 + 수동      |
| 2.1.2 버전 보관 정책           | ✅ 최대 50개, 자동 정리                  |
| 2.1.3 수동 버전(체크포인트)    | ✅ label 붙여 저장                       |
| 2.2.1 타임라인 목록            | ✅ VersionPanel                          |
| 2.2.2 변경 요약 자동 생성      | ✅ metadata { added, removed, modified } |
| 2.3.1 버전 미리보기(읽기 전용) | ✅ VersionPreviewModal                   |
| 2.3.2 차이 보기(diff)          | ❌ 1차 범위 제외 (metadata 숫자 요약만)  |
| 2.4.1 전체 복원(롤백)          | ✅ restore 엔드포인트                    |
| 2.4.2 부분 병합(선택 적용)     | ❌ 1차 범위 제외 (복잡도 높음)           |
| 2.4.3 복원/병합 충돌 처리      | ✅ advisory lock + 확인 Alert            |

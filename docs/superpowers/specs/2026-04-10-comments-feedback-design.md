# 주석 및 피드백 시스템 설계

|          |                           |
| -------- | ------------------------- |
| **날짜** | 2026-04-10                |
| **상태** | 승인됨                    |
| **범위** | Phase 3 — 주석/피드백 MVP |

---

## 결정 사항 요약

| 항목        | 결정                                          |
| ----------- | --------------------------------------------- |
| UI 방식     | 하이브리드 (캔버스 핀 + 우측 슬라이드인 패널) |
| 앵커링 대상 | 노드 + 캔버스 빈 영역 모두                    |
| 생성 방식   | 전용 모드 (툴바 버튼 + `C` 단축키)            |
| 실시간      | Socket.io WebSocket 브로드캐스트              |
| @멘션 알림  | 제외 (MVP) — 텍스트로만 표시                  |
| API 방식    | REST CRUD + 변경 시 Socket emit               |

---

## 1. 데이터 모델

### 1.1 스키마

```sql
-- anchor_type enum
CREATE TYPE anchor_type AS ENUM ('node', 'canvas');

-- comment_status enum
CREATE TYPE comment_status AS ENUM ('open', 'resolved');

CREATE TABLE comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyboard_id   UUID NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES users(id),
  anchor_type     anchor_type NOT NULL,
  anchor_node_id  TEXT,           -- anchor_type = 'node' 시 ReactFlow 노드 ID
  canvas_x        DOUBLE PRECISION,  -- anchor_type = 'canvas' 시 flow 좌표
  canvas_y        DOUBLE PRECISION,
  content         TEXT NOT NULL,
  status          comment_status NOT NULL DEFAULT 'open',
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 앵커 타입별 nullable 조합 강제
  CONSTRAINT anchor_node_check CHECK (
    (anchor_type = 'node' AND anchor_node_id IS NOT NULL AND canvas_x IS NULL AND canvas_y IS NULL)
    OR
    (anchor_type = 'canvas' AND anchor_node_id IS NULL AND canvas_x IS NOT NULL AND canvas_y IS NOT NULL)
  ),
  -- resolved_by / resolved_at 쌍 보장
  CONSTRAINT resolved_pair_check CHECK (
    (resolved_by IS NULL) = (resolved_at IS NULL)
  )
);

CREATE TABLE comment_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.2 인덱스

```sql
-- 가장 빈번한 쿼리: storyboard별 주석 조회 + 상태 필터
CREATE INDEX idx_comments_storyboard_status ON comments(storyboard_id, status);
-- 시간순 정렬
CREATE INDEX idx_comments_storyboard_created ON comments(storyboard_id, created_at);
-- 답글 조회
CREATE INDEX idx_replies_comment_created ON comment_replies(comment_id, created_at);
```

### 1.3 Drizzle ORM 주의사항

- `comment_replies` FK에 `onDelete: 'cascade'` 명시
- `updatedAt`에 `.$onUpdate(() => new Date())` 사용
- pgEnum 값 삭제/이름 변경은 수동 SQL 필요 — status/anchor_type 확장 시 주의

---

## 2. API 설계

### 2.1 NestJS 모듈 구조

```
apps/api/src/comments/
├── comments.module.ts
├── comments.controller.ts
├── comments.service.ts      # CRUD + Socket 브로드캐스트
└── dto/
    ├── create-comment.dto.ts
    ├── create-reply.dto.ts
    ├── update-comment-status.dto.ts
    └── update-reply.dto.ts
```

### 2.2 REST 엔드포인트

```
GET    /storyboards/:id/comments     # 주석 + 답글 전체 조회 (with replies)
POST   /storyboards/:id/comments     # 주석 생성
PATCH  /comments/:id/status          # 해결(resolved) / 재오픈(open)
DELETE /comments/:id                 # 주석 삭제 (replies cascade)

POST   /comments/:id/replies         # 답글 생성
PATCH  /replies/:id                  # 답글 수정
DELETE /replies/:id                  # 답글 삭제
```

### 2.3 Socket.io 이벤트

서비스 레이어에서 REST 처리 후 `this.server.to(storyboardId).emit(...)` 브로드캐스트.

```
comment:created       { comment }
comment:deleted       { commentId }
comment:status_changed { commentId, status, resolvedBy, resolvedAt }
reply:created         { reply }
reply:updated         { reply }
reply:deleted         { replyId, commentId }
```

---

## 3. 프론트엔드 구조

### 3.1 컴포넌트 트리

```
apps/web/src/components/storyboard/
├── editor.tsx                    # isCommentMode 분기 추가
└── comments/
    ├── CommentOverlay.tsx        # SVG 오버레이 (PresenceLayer 패턴)
    ├── CommentPin.tsx            # 개별 핀 (SVG foreignObject, pointer-events: auto)
    ├── CommentPanel.tsx          # 우측 슬라이드인 패널 + 미해결 필터 토글
    ├── CommentThread.tsx         # 스레드 (주석 본문 + 답글 목록)
    ├── CommentInput.tsx          # 주석/답글 입력창
    └── useComments.ts            # fetch + Socket 구독 + 낙관적 업데이트
```

### 3.2 상태 관리

- `isCommentMode` → `editor-store.ts` (Zustand), **persist 제외**
- `comments` 목록 → `useComments` 훅 내부 로컬 상태

### 3.3 주석 생성 흐름

```
[C 키 / 툴바 버튼] → isCommentMode = true
  → nodesDraggable / nodesConnectable / elementsSelectable = false
  → 커서 변경 (crosshair)

[빈 캔버스 클릭] → screenToFlowPosition(clientX, clientY) → canvas_x, canvas_y
[노드 클릭]      → anchor_node_id 캡처
  → 낙관적으로 임시 핀 추가 → POST /comments → 서버 응답 id로 교체

REST 응답 후 Socket emit → 다른 클라이언트 핀 즉시 갱신

[Escape] → isCommentMode = false → 정상 모드 복귀
```

### 3.4 핀 오버레이

- `PresenceLayer`와 동일하게 `<ReactFlow>` children으로 SVG 오버레이 렌더링
- 핀은 flow 좌표계에 붙어 캔버스 이동/줌 시 함께 이동
- 노드 앵커: `nodes.find(n => n.id === anchor_node_id).position`으로 좌표 조회
- 캔버스 앵커: `canvas_x`, `canvas_y` 직접 사용

### 3.5 CommentPanel

- 핀 클릭 → 우측에서 슬라이드인
- 미해결(open) / 전체 필터 토글
- 선택된 주석 스레드 하이라이트

### 3.6 blueprint 모드

`isBlueprint` 시 주석 기능 전체 비활성화 (협업 기능과 동일 처리).

---

## 4. 권한 정책

- 주석 **수정**: 미지원 (MVP — 삭제 후 재작성)
- 주석 **삭제**: 작성자 본인만 가능
- 주석 **해결/재오픈**: 스토리보드 접근 권한 있는 모든 멤버
- 답글 **수정/삭제**: 작성자 본인만 가능

서비스 레이어에서 `getCurrentUserId()`로 검증, 불일치 시 403.

---

## 6. 스코프 외 (다음 스프린트)

- @멘션 → 인앱 알림 시스템
- 이메일/Slack 알림 연동
- 읽음/미읽음 상태 관리
- 주석 모드 단축키 커스터마이징

---

## 7. 완료 기준 (Definition of Done)

- [ ] DB 마이그레이션 성공 (comments, comment_replies 테이블 + CHECK 제약 + 인덱스)
- [ ] REST API 7개 엔드포인트 동작
- [ ] Socket.io 6개 이벤트 브로드캐스트 동작
- [ ] 주석 모드 토글 (C 키 + 툴바 버튼 + Escape)
- [ ] 노드/캔버스 앵커 핀 생성 및 표시
- [ ] 슬라이드인 패널에서 스레드/답글 CRUD
- [ ] 해결/재오픈 상태 변경
- [ ] 실시간: 다른 사용자 화면에 즉시 반영
- [ ] blueprint 모드에서 비활성화
- [ ] 낙관적 업데이트 (본인 핀 즉시 표시)

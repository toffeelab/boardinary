# Spec: 실시간 협업 편집 (Real-time Collaborative Editing)

**날짜:** 2026-04-09
**상태:** 승인됨
**우선순위:** 🔴 높음 (제품 명세서 기준 최우선 기능)

---

## 개요

여러 사용자가 동일한 스토리보드를 동시에 편집할 수 있는 실시간 협업 시스템. 서버 권위(Server Authority) + WebSocket 브로드캐스트 방식으로 구현하며, 프레즌스(커서/선택 표시)를 포함한다.

---

## 아키텍처

### 전체 구조

```
[Web Client A]                    [NestJS API]                [Web Client B]
    │                                   │                           │
    ├── socket.emit('node:update') ────►│                           │
    │                                   ├── 권한 확인               │
    │                                   ├── atomic UPDATE (version) │
    │                                   ├── broadcast to room ─────►│
    │◄── 'node:update' (ack) ──────────┤                           │
```

### 신규 컴포넌트

**백엔드 (`apps/api/src/collaboration/`)**

- `CollaborationGateway` — Socket.IO 게이트웨이, 룸 관리, 이벤트 라우팅
- `CollaborationService` — 권한 확인, DB 저장 (300ms debounce), 충돌 감지
- `CollaborationAdapterModule` — in-memory 기본, 환경변수(`COLLAB_ADAPTER=redis`)로 Redis 전환
- `WsJwtGuard` — handshake JWT 검증 (`Promise<boolean>` 반환)

**프론트엔드 (`apps/web/src/`)**

- `hooks/use-collaboration.ts` — WebSocket 연결, 오프라인 큐, 재연결 처리
- `stores/collaboration-slice.ts` — Zustand slice, 프레즌스 상태
- `components/storyboard/presence-layer.tsx` — ReactFlow 위 SVG 오버레이

---

## 데이터 모델

### UserPresence

```ts
interface UserPresence {
  userId: string;
  name: string;
  color: string; // 팔레트 8색 자동 배정
  cursor: { x: number; y: number } | null; // flow 좌표계
  selectedNodeIds: string[];
  lastSeen: number; // timestamp ms
}
```

### Operation (오프라인 큐)

```ts
interface Operation {
  id: string; // crypto.randomUUID() — idempotency key
  type:
    | "node:update"
    | "node:add"
    | "node:delete"
    | "edge:add"
    | "edge:update"
    | "edge:delete";
  payload: unknown;
  clientVersion: number;
  timestamp: number;
  retryCount: number;
}
```

---

## WebSocket 이벤트

| 이벤트            | 방향  | 페이로드                                         | 설명                       |
| ----------------- | ----- | ------------------------------------------------ | -------------------------- |
| `room:join`       | C→S   | `{ storyboardId }`                               | 룸 참가, 접근 권한 확인    |
| `room:leave`      | C→S   | `{ storyboardId }`                               | 룸 퇴장                    |
| `room:sync`       | C→S   | `{ storyboardId, version }`                      | 재연결 시 상태 요청        |
| `room:state`      | S→C   | `{ content, version, presence[] }`               | 전체 상태 (join/sync 응답) |
| `room:closing`    | S→C   | —                                                | graceful shutdown 알림     |
| `node:update`     | C→S→C | `{ storyboardId, node: Partial<Node>, version }` | 노드 수정                  |
| `node:add`        | C→S→C | `{ storyboardId, node: Node, version }`          | 노드 추가                  |
| `node:delete`     | C→S→C | `{ storyboardId, nodeId, version }`              | 노드 삭제                  |
| `edge:add`        | C→S→C | `{ storyboardId, edge: Edge, version }`          | 엣지 추가                  |
| `edge:update`     | C→S→C | `{ storyboardId, edge: Partial<Edge>, version }` | 엣지 수정                  |
| `edge:delete`     | C→S→C | `{ storyboardId, edgeId, version }`              | 엣지 삭제                  |
| `presence:update` | C→S→C | `{ cursor: {x,y} \| null, selectedNodeIds }`     | 커서/선택 브로드캐스트     |
| `collab:conflict` | S→C   | `{ nodeId, field, yourValue, winnerValue }`      | 덮어쓰기 알림              |

---

## 핵심 동작 명세

### 1. 동기화 & 충돌 해소

**서버 처리 순서 (매 mutation 이벤트):**

1. `WsJwtGuard`로 userId 추출
2. userId + storyboardId 접근 권한 확인 (`StoryboardsService.ensureStoryboardAccess`)
3. DTO 검증 (class-validator)
4. 원자적 UPDATE:
   ```sql
   UPDATE storyboards
   SET content = $1, content_version = content_version + 1, updated_at = now()
   WHERE id = $2 AND content_version = $3
   RETURNING content_version
   ```
5. 영향된 행 0 → 클라이언트 version이 낮음 → `room:state` 재전송 (서버 우선)
6. 성공 → 룸 브로드캐스트 (발신자 제외)
7. 동일 nodeId에 대해 300ms 이내 다른 클라이언트 편집이 있었으면 → 덮어씌워진 클라이언트에 `collab:conflict` 전송

**300ms debounce 저장:**

- 같은 storyboardId에 대한 연속 이벤트를 300ms window로 묶어 DB 1회 저장
- 브로드캐스트는 debounce 없이 즉시 (실시간성 유지)

### 2. Undo/Redo 격리

```ts
// editor.tsx / use-undo-redo.ts
function applyRemoteUpdate(delta: NodeDelta) {
  setIsRemoteUpdate(true)   // 플래그 ON
  setNodes(...)             // 적용
  setIsRemoteUpdate(false)  // 플래그 OFF
}

function pushSnapshot() {
  if (isRemoteUpdate) return  // 원격 변경은 Undo 스택에 쌓지 않음
  // ... 기존 로직
}
```

### 3. REST 자동저장과 version 동기화

WebSocket으로 `node:update` 등을 수신할 때마다:

```ts
setContentVersion(event.version); // Zustand 즉시 갱신
```

→ 이후 REST 자동저장이 최신 version으로 요청하므로 충돌 방지.

### 4. 재연결 & 오프라인 큐

```
연결 끊김 감지
  → socket.on('disconnect')
  → 이후 조작을 offlineQueue[]에 적재

재연결 성공
  → socket.emit('room:sync', { storyboardId, version: lastKnownVersion })
  → 서버: room:state 응답 (현재 전체 상태)
  → 클라이언트: 서버 상태로 덮어씀
  → offlineQueue에서 serverVersion 이후 operation만 필터링
  → 순서대로 재emit (id로 중복 방지)
```

### 5. 프레즌스

**커서 전송:**

```ts
// 마우스 이동 이벤트 (100ms throttle)
const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
socket.emit("presence:update", { cursor: flowPos, selectedNodeIds });
```

**PresenceLayer 렌더링:**

- `useViewport()`로 `{ x, y, zoom }` 구독
- SVG 위치: flow 좌표를 viewport transform으로 변환하여 렌더링
- 각 사용자: 색상 화살표 커서 + 이름 태그 (SVG `<foreignObject>`)
- 선택 노드 하이라이트: ReactFlow `nodeClassName` prop으로 색상 border 클래스 주입
- 5초(`lastSeen` 기준) 무응답 시 opacity 0으로 페이드아웃

**입장/퇴장 알림:**

- `room:join` 시 다른 사용자에게 토스트: "홍길동 님이 입장했습니다"
- `room:leave` / `disconnect` 시: "홍길동 님이 퇴장했습니다"

### 6. CollaborationAdapterModule

```ts
// apps/api/src/collaboration/collaboration-adapter.module.ts
@Module({})
export class CollaborationAdapterModule {
  static register(): DynamicModule {
    if (process.env.COLLAB_ADAPTER === 'redis') {
      return { providers: [RedisAdapterProvider], exports: [...] }
    }
    return { providers: [InMemoryAdapterProvider], exports: [...] }
  }
}
```

### 7. Graceful Shutdown

```ts
// main.ts
app.enableShutdownHooks()

// CollaborationGateway
@OnEvent('app.shutdown')
async onShutdown() {
  this.server.emit('room:closing')
  await sleep(1000)
  this.server.disconnectSockets()
}
```

---

## 보안

- **handshake 인증**: `socket.handshake.auth.token` JWT 검증 (`WsJwtGuard`)
- **매 mutation 권한 확인**: `room:join` 이후에도 각 이벤트마다 userId + storyboardId 접근 권한 재확인
- **DTO 검증**: 모든 WebSocket 페이로드 class-validator + `WsPipe`
- **프레즌스 데이터**: DB 저장 없음, 메모리 룸 Map에만 보관

---

## 성능

| 항목                   | 설정                    |
| ---------------------- | ----------------------- |
| 커서 이벤트 throttle   | 100ms                   |
| DB 저장 debounce       | 300ms                   |
| 프레즌스 타임아웃      | 5초                     |
| Socket.IO max payload  | 5MB (환경변수 설정)     |
| 무응답 커서 페이드아웃 | opacity transition 0.5s |

---

## 테스트 전략

| 레이어 | 항목                                                                     |
| ------ | ------------------------------------------------------------------------ |
| 단위   | `CollaborationService` debounce 로직, conflict 감지 로직                 |
| 단위   | `calcOfflineQueueReplay` — 서버 버전 이후 operation 필터링               |
| 통합   | Socket.IO 테스트 클라이언트로 room:join → node:update → broadcast 검증   |
| 통합   | 원자적 UPDATE race condition — 두 클라이언트 동시 전송 시 version 일관성 |
| E2E    | 두 브라우저 탭에서 동시 편집 → 양쪽 동기화 확인                          |

---

## 범위 밖 (이번 Phase 제외)

- 오프라인 우선 편집 (Y.js CRDT)
- 편집 히스토리 타임라인 (버전 관리)
- 주석/코멘트 시스템
- Redis 어댑터 실제 구현 (모듈 추상화만 이번에 포함)
- 동시 접속자 수 제한

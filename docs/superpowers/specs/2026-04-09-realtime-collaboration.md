# Spec: 실시간 협업 편집 (Real-time Collaborative Editing)

**날짜:** 2026-04-09
**상태:** 승인됨
**우선순위:** 🔴 높음 (제품 명세서 기준 최우선 기능)

---

## 개요

여러 사용자가 동일한 스토리보드를 동시에 편집할 수 있는 실시간 협업 시스템. **서버 권위(Server Authority) + Redis source of truth + WebSocket 브로드캐스트** 방식으로 구현하며, 프레즌스(커서/선택 표시)를 포함한다.

Redis를 즉시 적용하는 이유:

- 노드 단위 원자적 업데이트 (`HSET`) → 전체 JSONB 교체 없이 노드별 LWW 가능
- 브로드캐스트와 DB 저장 타이밍 분리 (Redis가 source of truth, DB는 async flush)
- 권한 캐싱으로 매 이벤트 DB 쿼리 제거
- 프레즌스 지속성 (서버 재시작 후에도 유지)

---

## 아키텍처

### 전체 구조

```
[Web Client A]                [NestJS API + Redis]              [Web Client B]
    │                                   │                           │
    ├── socket.emit('node:update') ────►│                           │
    │                                   ├── 권한 확인 (Redis 캐시)  │
    │                                   ├── HSET nodes:{nodeId}     │
    │                                   ├── INCR version            │
    │                                   ├── broadcast to room ─────►│
    │◄── ack ──────────────────────────┤                           │
    │                                   ├── (30s후 or 퇴장시 DB flush)
```

### 신규 컴포넌트

**백엔드 (`apps/api/src/collaboration/`)**

- `CollaborationGateway` — Socket.IO 게이트웨이, 룸 관리, 이벤트 라우팅
- `CollaborationService` — 권한 확인, Redis 읽기/쓰기, 충돌 감지, DB flush
- `CollaborationRedisModule` — `ioredis` 연결, Redis key 헬퍼
- `WsJwtGuard` — handshake JWT 검증 (`Promise<boolean>` 반환)

**프론트엔드 (`apps/web/src/`)**

- `hooks/use-collaboration.ts` — WebSocket 연결, 오프라인 큐, 재연결 처리
- `stores/collaboration-slice.ts` — Zustand slice, 프레즌스 상태
- `components/storyboard/presence-layer.tsx` — ReactFlow 위 SVG 오버레이

**인프라**

- 로컬: `docker-compose.yml`에 Redis 추가 (port 6379)
- 프로덕션: Upstash Redis (Neon과 동일 리전)

---

## Redis 데이터 구조

```
# 노드/엣지 (Hash — 노드 단위 원자적 업데이트)
storyboard:{id}:nodes     → Hash { nodeId: JSON }
storyboard:{id}:edges     → Hash { edgeId: JSON }

# 버전 (단조 증가)
storyboard:{id}:version   → String (integer)

# 프레즌스 (Hash — DB 저장 없음)
storyboard:{id}:presence  → Hash { userId: JSON(UserPresence) }

# 권한 캐시 (TTL 5분)
auth:{socketId}           → Hash { userId, name, authorizedRooms: JSON([storyboardId]) }

# DB flush 더티 플래그 (30초 주기 flush용)
storyboard:{id}:dirty     → String "1"  TTL 30s
```

**TTL 정책:**

- `storyboard:{id}:*` — 마지막 사용자 퇴장 후 10분 만료 (EXPIRE 갱신)
- `auth:{socketId}` — 5분 TTL, 이벤트마다 갱신
- `presence` 내 개별 유저 — 5초 무응답 시 `HDEL`

---

## 데이터 모델

### UserPresence

```ts
interface UserPresence {
  userId: string;
  name: string;
  color: string; // 팔레트 8색, 같은 룸 내 중복 방지
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

| 이벤트            | 방향  | 페이로드                                         | 설명                                 |
| ----------------- | ----- | ------------------------------------------------ | ------------------------------------ |
| `room:join`       | C→S   | `{ storyboardId }`                               | 룸 참가, 권한 확인                   |
| `room:leave`      | C→S   | `{ storyboardId }`                               | 룸 퇴장                              |
| `room:sync`       | C→S   | `{ storyboardId, version }`                      | 재연결 시 상태 요청                  |
| `room:state`      | S→C   | `{ content, version, presence[] }`               | 전체 상태 (join/sync 응답)           |
| `room:replay`     | C→S   | `{ storyboardId, ops: Operation[] }`             | 재연결 시 오프라인 큐 일괄 전송      |
| `room:closing`    | S→C   | —                                                | graceful shutdown 알림               |
| `node:update`     | C→S→C | `{ storyboardId, node: Partial<Node>, version }` | 노드 수정                            |
| `node:add`        | C→S→C | `{ storyboardId, node: Node, version }`          | 노드 추가                            |
| `node:delete`     | C→S→C | `{ storyboardId, nodeId, version }`              | 노드 삭제                            |
| `edge:add`        | C→S→C | `{ storyboardId, edge: Edge, version }`          | 엣지 추가                            |
| `edge:update`     | C→S→C | `{ storyboardId, edge: Partial<Edge>, version }` | 엣지 수정                            |
| `edge:delete`     | C→S→C | `{ storyboardId, edgeId, version }`              | 엣지 삭제                            |
| `presence:update` | C→S→C | `{ cursor: {x,y} \| null, selectedNodeIds }`     | 커서/선택 (발신자 제외 브로드캐스트) |
| `collab:conflict` | S→C   | `{ nodeId }`                                     | 덮어쓰기 알림 (토스트만 표시)        |

---

## 핵심 동작 명세

### 1. 동기화 & 충돌 해소

**서버 처리 순서 (매 mutation 이벤트):**

1. `WsJwtGuard`로 userId 추출
2. Redis `auth:{socketId}` 캐시로 권한 확인 (캐시 미스 시 DB 조회 후 캐싱)
3. DTO 검증 (class-validator + `WsPipe`)
4. Redis 원자적 업데이트:
   ```
   HSET storyboard:{id}:nodes {nodeId} {nodeJson}
   INCR storyboard:{id}:version
   SET  storyboard:{id}:dirty "1"   (DB flush 트리거용)
   ```
5. 동일 nodeId에 대해 300ms 이내 다른 클라이언트 편집 감지 → 덮어씌워진 클라이언트에 `collab:conflict` 전송
   - 감지: Redis `storyboard:{id}:nodes:{nodeId}:lastWriter` (socketId + TTL 300ms)
   - 페이로드: `{ nodeId }` 만 전송, 클라이언트는 토스트 표시 ("다른 사용자가 이 노드를 수정했습니다")
6. 룸 브로드캐스트 (발신자 제외)

**DB flush 전략:**

- 30초 주기 background job: `dirty` 플래그 있는 storyboard → Redis에서 전체 nodes/edges 읽어 PostgreSQL JSONB 저장
- 마지막 사용자 퇴장 시: 즉시 flush 후 Redis TTL 10분 설정

### 2. Undo/Redo 격리

원격 변경 수신 시 Undo 스택에 쌓지 않도록 `ref` 플래그 사용:

```ts
const isRemoteUpdateRef = useRef(false)  // ref 사용 (비동기 안전)

function applyRemoteUpdate(delta: NodeDelta) {
  isRemoteUpdateRef.current = true
  setNodes(...)
  isRemoteUpdateRef.current = false
}

function pushSnapshot() {
  if (isRemoteUpdateRef.current) return  // 원격 변경은 Undo 스택에 쌓지 않음
  // ... 기존 로직
}
```

### 3. REST 자동저장과 version 동기화

WebSocket으로 이벤트 수신 시마다:

```ts
setContentVersion(event.version); // Zustand 즉시 갱신
```

→ 이후 REST 자동저장이 최신 version으로 요청하므로 충돌 방지.

### 4. 재연결 & 오프라인 큐 일괄 재전송

오프라인 큐 replay는 **단일 `room:replay` 이벤트**로 원자적 처리:

```
연결 끊김
  → socket.on('disconnect')
  → 이후 조작을 offlineQueue: Operation[] 에 적재

재연결 성공
  Step 1) socket.emit('room:sync', { storyboardId, version: lastKnownVersion })
  Step 2) 서버: room:state 응답 (Redis에서 현재 전체 상태)
          → version 동일하면 content 생략, presence만 전송
  Step 3) 클라이언트: 서버 상태 적용 (setNodes/setEdges)
  Step 4) offlineQueue에서 serverVersion 이후 operation 필터링
  Step 5) 필터된 ops를 단일 socket.emit('room:replay', { storyboardId, ops })
  Step 6) 서버: ops를 순서대로 처리, 중간에 다른 이벤트 차단 (Redis MULTI/EXEC)
          → 성공 시 브로드캐스트, 실패 operation은 skip + collab:conflict 전송
  Step 7) offlineQueue 비우기
```

`room:replay` 서버 처리 시 Redis `MULTI/EXEC` 트랜잭션으로 ops 일괄 적용 → replay 중 race condition 방지.

### 5. 프레즌스

**커서 전송 (100ms throttle):**

```ts
const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
socket.emit("presence:update", { cursor: flowPos, selectedNodeIds });
// 서버: Redis HSET storyboard:{id}:presence {userId} {json} → 브로드캐스트 (발신자 제외)
```

**서버 재시작 후 presence 복원:**

- 클라이언트가 reconnect 성공 후 즉시 `presence:update` 재전송 (hook 내 자동 처리)

**PresenceLayer 렌더링:**

- `useViewport()`로 `{ x, y, zoom }` 구독
- flow 좌표 → SVG 위치 변환
- 각 사용자: 색상 화살표 커서 + 이름 태그 (`<foreignObject>`)
- 선택 노드 하이라이트: ReactFlow `nodeClassName` prop으로 색상 border 클래스 주입
- Zustand selector 분리: `useCollabStore(s => s.presence[userId])` (유저별 개별 구독)
- 5초 무응답 시 opacity 0 페이드아웃

**색상 배정:**

- 팔레트 8색, `room:join` 시 서버가 현재 룸 사용 중 색상 제외 후 배정
- 8명 초과 시 퇴장한 색상 재사용 (같은 방 내 중복 없음)

**입장/퇴장 알림:**

- `room:join` → 다른 사용자에게 토스트: "홍길동 님이 입장했습니다"
- `room:leave` / `disconnect` → "홍길동 님이 퇴장했습니다"

### 6. Graceful Shutdown

```ts
// main.ts
app.enableShutdownHooks()

// CollaborationGateway
@OnEvent('app.shutdown')
async onShutdown() {
  this.server.emit('room:closing')
  await sleep(1000)
  // 모든 active room flush
  await this.collaborationService.flushAllDirtyRooms()
  this.server.disconnectSockets()
}
```

---

## 보안

- **handshake 인증**: `socket.handshake.auth.token` JWT 검증 (`WsJwtGuard`)
- **권한 확인**: Redis `auth:{socketId}` 캐시 (TTL 5분) → 캐시 미스 시 DB 조회
- **DTO 검증**: 모든 WebSocket 페이로드 class-validator + `WsPipe`
- **프레즌스 데이터**: DB 저장 없음, Redis에만 보관 (TTL 만료로 자동 정리)

---

## 인프라 & 환경변수

**docker-compose.yml 추가:**

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

**신규 환경변수:**

| 변수                       | 로컬 기본값              | 설명                  |
| -------------------------- | ------------------------ | --------------------- |
| `REDIS_URL`                | `redis://localhost:6379` | Redis 연결 URL        |
| `COLLAB_FLUSH_INTERVAL_MS` | `30000`                  | DB flush 주기 (ms)    |
| `SOCKET_MAX_PAYLOAD_MB`    | `5`                      | Socket.IO max payload |

---

## 성능

| 항목                   | 설정                         |
| ---------------------- | ---------------------------- |
| 커서 이벤트 throttle   | 100ms                        |
| DB flush 주기          | 30초 (+ 마지막 퇴장 시 즉시) |
| 권한 캐시 TTL          | 5분                          |
| 프레즌스 타임아웃      | 5초                          |
| Redis TTL (storyboard) | 마지막 퇴장 후 10분          |
| Socket.IO max payload  | 5MB                          |

---

## 테스트 전략

| 레이어 | 항목                                                                      |
| ------ | ------------------------------------------------------------------------- |
| 단위   | `CollaborationService` — Redis 업데이트, conflict 감지 (300ms window)     |
| 단위   | `calcOfflineQueueReplay` — serverVersion 이후 operation 필터링            |
| 단위   | `PresenceLayer` — `screenToFlowPosition` 좌표 변환                        |
| 통합   | Socket.IO 테스트 클라이언트: `room:join` → `node:update` → broadcast 검증 |
| 통합   | `room:replay` — 동시 다른 이벤트와 race condition 없음 검증               |
| 통합   | 두 클라이언트 동시 `node:update` → 각각 `collab:conflict` or 정상 처리    |
| E2E    | 두 브라우저 탭 동시 편집 → 양쪽 동기화 확인                               |
| E2E    | 탭 오프라인 후 재연결 → `room:replay` 후 양쪽 일치 확인                   |

---

## 범위 밖 (이번 Phase 제외)

- 오프라인 우선 편집 (Y.js CRDT)
- 편집 히스토리 타임라인 (버전 관리)
- 주석/코멘트 시스템
- Socket.IO Redis Adapter (수평 확장용 — 단일 인스턴스에선 불필요)
- 동시 접속자 수 제한

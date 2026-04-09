import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { OnEvent } from "@nestjs/event-emitter";
import { WsAuthGuard } from "./guards/ws-auth.guard";
import { CollaborationService } from "./collaboration.service";
import { JoinRoomDto } from "./dto/join-room.dto";
import { SyncEventDto } from "./dto/sync-event.dto";
import { NodeEventDto } from "./dto/node-event.dto";
import { EdgeEventDto } from "./dto/edge-event.dto";
import { PresenceEventDto } from "./dto/presence-event.dto";
import { ReplayEventDto } from "./dto/replay-event.dto";
import type { UserPresence, Operation } from "@repo/types";

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_URL ?? "http://localhost:4000",
    credentials: true,
  },
  maxHttpBufferSize:
    parseInt(process.env.SOCKET_MAX_PAYLOAD_MB ?? "5") * 1024 * 1024,
})
@UseGuards(WsAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class CollaborationGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // socketId → storyboardId (단일 룸 가정)
  private readonly socketRoom = new Map<string, string>();

  constructor(private readonly collaborationService: CollaborationService) {}

  @SubscribeMessage("room:join")
  async handleJoin(
    @MessageBody() dto: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data["userId"] as string;
    const name = client.data["name"] as string;

    const canAccess = await this.collaborationService.checkAccess(
      client.id,
      dto.storyboardId,
      userId,
    );
    if (!canAccess) {
      client.emit("error", { message: "Access denied" });
      return;
    }

    await this.collaborationService.initRoomFromDb(dto.storyboardId);

    client.join(dto.storyboardId);
    this.socketRoom.set(client.id, dto.storyboardId);

    const color = this.collaborationService.assignColor(
      dto.storyboardId,
      userId,
    );
    const state = await this.collaborationService.getRoomState(
      dto.storyboardId,
      -1,
    );

    client.emit("room:state", state);

    // 입장 알림
    client
      .to(dto.storyboardId)
      .emit("room:user-joined", { userId, name, color });

    // 이 소켓의 presence 초기화
    const presence: UserPresence = {
      userId,
      name,
      color,
      cursor: null,
      selectedNodeIds: [],
      lastSeen: Date.now(),
    };
    await this.collaborationService.updatePresence(dto.storyboardId, presence);
  }

  @SubscribeMessage("room:leave")
  async handleLeave(
    @MessageBody() dto: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    await this.leaveRoom(client, dto.storyboardId);
  }

  @SubscribeMessage("room:sync")
  async handleSync(
    @MessageBody() dto: SyncEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const state = await this.collaborationService.getRoomState(
      dto.storyboardId,
      dto.version,
    );
    client.emit("room:state", state);
  }

  @SubscribeMessage("node:update")
  async handleNodeUpdate(
    @MessageBody() dto: NodeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const { version, conflictSocketId } =
      await this.collaborationService.handleNodeUpdate(
        dto.storyboardId,
        client.id,
        dto.node,
      );

    if (conflictSocketId) {
      this.server.to(conflictSocketId).emit("collab:conflict", {
        nodeId: dto.node["id"] as string,
      });
    }

    client
      .to(dto.storyboardId)
      .emit("node:update", { node: dto.node, version });
    client.emit("node:update:ack", { version });
  }

  @SubscribeMessage("node:add")
  async handleNodeAdd(
    @MessageBody() dto: NodeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const { version } = await this.collaborationService.handleNodeUpdate(
      dto.storyboardId,
      client.id,
      dto.node,
    );
    client.to(dto.storyboardId).emit("node:add", { node: dto.node, version });
    client.emit("node:add:ack", { version });
  }

  @SubscribeMessage("node:delete")
  async handleNodeDelete(
    @MessageBody() dto: NodeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const nodeId = dto.nodeId ?? (dto.node["id"] as string);
    const version = await this.collaborationService.handleNodeDelete(
      dto.storyboardId,
      nodeId,
    );
    client.to(dto.storyboardId).emit("node:delete", { nodeId, version });
    client.emit("node:delete:ack", { version });
  }

  @SubscribeMessage("edge:add")
  async handleEdgeAdd(
    @MessageBody() dto: EdgeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const version = await this.collaborationService.handleEdgeUpdate(
      dto.storyboardId,
      dto.edge!,
    );
    client.to(dto.storyboardId).emit("edge:add", { edge: dto.edge, version });
    client.emit("edge:add:ack", { version });
  }

  @SubscribeMessage("edge:update")
  async handleEdgeUpdate(
    @MessageBody() dto: EdgeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const version = await this.collaborationService.handleEdgeUpdate(
      dto.storyboardId,
      dto.edge!,
    );
    client
      .to(dto.storyboardId)
      .emit("edge:update", { edge: dto.edge, version });
    client.emit("edge:update:ack", { version });
  }

  @SubscribeMessage("edge:delete")
  async handleEdgeDelete(
    @MessageBody() dto: EdgeEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const version = await this.collaborationService.handleEdgeDelete(
      dto.storyboardId,
      dto.edgeId!,
    );
    client
      .to(dto.storyboardId)
      .emit("edge:delete", { edgeId: dto.edgeId, version });
    client.emit("edge:delete:ack", { version });
  }

  @SubscribeMessage("presence:update")
  async handlePresence(
    @MessageBody() dto: PresenceEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const storyboardId = this.socketRoom.get(client.id);
    if (!storyboardId) return;

    const userId = client.data["userId"] as string;
    const name = client.data["name"] as string;
    const color = this.collaborationService.assignColor(storyboardId, userId);

    const presence: UserPresence = {
      userId,
      name,
      color,
      cursor: dto.cursor ?? null,
      selectedNodeIds: dto.selectedNodeIds,
      lastSeen: Date.now(),
    };

    await this.collaborationService.updatePresence(storyboardId, presence);
    client.to(storyboardId).emit("presence:update", presence);
  }

  @SubscribeMessage("room:replay")
  async handleReplay(
    @MessageBody() dto: ReplayEventDto,
    @ConnectedSocket() client: Socket,
  ) {
    const ops = dto.ops as Operation[];
    for (const op of ops) {
      try {
        if (op.type === "node:update" || op.type === "node:add") {
          const { version } = await this.collaborationService.handleNodeUpdate(
            dto.storyboardId,
            client.id,
            op.payload as Record<string, unknown>,
          );
          client.to(dto.storyboardId).emit(op.type, {
            node: op.payload,
            version,
          });
        } else if (op.type === "node:delete") {
          const payload = op.payload as { nodeId: string };
          const version = await this.collaborationService.handleNodeDelete(
            dto.storyboardId,
            payload.nodeId,
          );
          client.to(dto.storyboardId).emit("node:delete", {
            nodeId: payload.nodeId,
            version,
          });
        } else if (op.type === "edge:add" || op.type === "edge:update") {
          const version = await this.collaborationService.handleEdgeUpdate(
            dto.storyboardId,
            op.payload as Record<string, unknown>,
          );
          client
            .to(dto.storyboardId)
            .emit(op.type, { edge: op.payload, version });
        } else if (op.type === "edge:delete") {
          const payload = op.payload as { edgeId: string };
          const version = await this.collaborationService.handleEdgeDelete(
            dto.storyboardId,
            payload.edgeId,
          );
          client.to(dto.storyboardId).emit("edge:delete", {
            edgeId: payload.edgeId,
            version,
          });
        }
      } catch {
        // 실패한 operation은 skip
      }
    }
    client.emit("room:replay:done");
  }

  async handleDisconnect(client: Socket) {
    const storyboardId = this.socketRoom.get(client.id);
    if (!storyboardId) return;

    const userId = client.data["userId"] as string;
    const name = client.data["name"] as string;

    const roomSize =
      this.server.sockets.adapter.rooms.get(storyboardId)?.size ?? 0;
    const isLastUser = roomSize <= 1;

    await this.collaborationService.onUserLeave(
      storyboardId,
      userId,
      client.id,
      isLastUser,
    );

    this.socketRoom.delete(client.id);
    client.to(storyboardId).emit("room:user-left", { userId, name });
  }

  @OnEvent("app.shutdown")
  async onShutdown() {
    this.server.emit("room:closing");
    await new Promise((r) => setTimeout(r, 1000));
    await this.collaborationService.flushAllDirtyRooms();
    this.server.disconnectSockets();
  }

  private async leaveRoom(client: Socket, storyboardId: string) {
    const userId = client.data["userId"] as string;
    const name = client.data["name"] as string;
    const roomSize =
      this.server.sockets.adapter.rooms.get(storyboardId)?.size ?? 0;
    const isLastUser = roomSize <= 1;

    client.leave(storyboardId);
    this.socketRoom.delete(client.id);

    await this.collaborationService.onUserLeave(
      storyboardId,
      userId,
      client.id,
      isLastUser,
    );
    client.to(storyboardId).emit("room:user-left", { userId, name });
  }
}

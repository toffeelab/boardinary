"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type { Node, Edge } from "@xyflow/react";
import type { Operation, RoomStatePayload, UserPresence } from "@repo/types";
import { useCollaborationStore } from "@/stores/collaboration-slice";
import { useEditorStore } from "@/stores/editor-store";
import { filterQueueAfterVersion } from "@/lib/offline-queue";
import { getCollabTokenAction } from "@/actions/get-collab-token-action";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4001";

interface UseCollaborationOptions {
  storyboardId: string;
  isRemoteUpdateRef: React.MutableRefObject<boolean>;
  onNodesUpdate: (nodes: Node[]) => void;
  onEdgesUpdate: (edges: Edge[]) => void;
  onNodeRemote: (node: Record<string, unknown>, version: number) => void;
  onNodeDeleteRemote: (nodeId: string, version: number) => void;
  onEdgeRemote: (edge: Record<string, unknown>, version: number) => void;
  onEdgeDeleteRemote: (edgeId: string, version: number) => void;
}

export function useCollaboration({
  storyboardId,
  isRemoteUpdateRef,
  onNodesUpdate,
  onEdgesUpdate,
  onNodeRemote,
  onNodeDeleteRemote,
  onEdgeRemote,
  onEdgeDeleteRemote,
}: UseCollaborationOptions) {
  const socketRef = useRef<Socket | null>(null);
  const offlineQueueRef = useRef<Operation[]>([]);
  const isOfflineRef = useRef(false);

  const {
    setConnected,
    setPresence,
    removePresence,
    clearPresence,
    setCollabToken,
  } = useCollaborationStore();
  const { setContentVersion } = useEditorStore();

  const applyRoomState = useCallback(
    (state: RoomStatePayload) => {
      if (state.content) {
        isRemoteUpdateRef.current = true;
        const content = state.content as { nodes?: Node[]; edges?: Edge[] };
        if (content.nodes) onNodesUpdate(content.nodes);
        if (content.edges) onEdgesUpdate(content.edges);
        isRemoteUpdateRef.current = false;
      }
      setContentVersion(state.version);

      clearPresence();
      for (const p of state.presence) {
        setPresence(p.userId, p);
      }
    },
    [
      isRemoteUpdateRef,
      onNodesUpdate,
      onEdgesUpdate,
      setContentVersion,
      clearPresence,
      setPresence,
    ],
  );

  useEffect(() => {
    let socket: Socket;

    async function connect() {
      const result = await getCollabTokenAction();
      if ("error" in result) return;

      setCollabToken(result.token);

      socket = io(WS_URL, {
        auth: { token: result.token },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);

        if (isOfflineRef.current) {
          // 재연결 흐름
          const lastVersion = useEditorStore.getState().contentVersion;
          socket.emit("room:sync", { storyboardId, version: lastVersion });
        } else {
          socket.emit("room:join", { storyboardId });
        }
        isOfflineRef.current = false;
      });

      socket.on("disconnect", () => {
        setConnected(false);
        isOfflineRef.current = true;
      });

      socket.on("room:state", (state: RoomStatePayload) => {
        const serverVersion = state.version;
        applyRoomState(state);

        // 오프라인 큐 replay
        const toReplay = filterQueueAfterVersion(
          offlineQueueRef.current,
          serverVersion,
        );
        if (toReplay.length > 0) {
          socket.emit("room:replay", { storyboardId, ops: toReplay });
        }
        offlineQueueRef.current = [];

        // 재연결 후 presence 재전송
        if (isOfflineRef.current) {
          socket.emit("presence:update", { cursor: null, selectedNodeIds: [] });
        }
      });

      socket.on("room:closing", () => {
        setConnected(false);
      });

      // 노드 이벤트
      socket.on(
        "node:update",
        ({
          node,
          version,
        }: {
          node: Record<string, unknown>;
          version: number;
        }) => {
          isRemoteUpdateRef.current = true;
          onNodeRemote(node, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      socket.on(
        "node:add",
        ({
          node,
          version,
        }: {
          node: Record<string, unknown>;
          version: number;
        }) => {
          isRemoteUpdateRef.current = true;
          onNodeRemote(node, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      socket.on(
        "node:delete",
        ({ nodeId, version }: { nodeId: string; version: number }) => {
          isRemoteUpdateRef.current = true;
          onNodeDeleteRemote(nodeId, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      // 엣지 이벤트
      socket.on(
        "edge:add",
        ({
          edge,
          version,
        }: {
          edge: Record<string, unknown>;
          version: number;
        }) => {
          isRemoteUpdateRef.current = true;
          onEdgeRemote(edge, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      socket.on(
        "edge:update",
        ({
          edge,
          version,
        }: {
          edge: Record<string, unknown>;
          version: number;
        }) => {
          isRemoteUpdateRef.current = true;
          onEdgeRemote(edge, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      socket.on(
        "edge:delete",
        ({ edgeId, version }: { edgeId: string; version: number }) => {
          isRemoteUpdateRef.current = true;
          onEdgeDeleteRemote(edgeId, version);
          setContentVersion(version);
          isRemoteUpdateRef.current = false;
        },
      );

      // 프레즌스
      socket.on("presence:update", (presence: UserPresence) => {
        setPresence(presence.userId, presence);
      });

      socket.on(
        "room:user-joined",
        ({
          userId,
          name,
          color,
        }: {
          userId: string;
          name: string;
          color: string;
        }) => {
          // 토스트는 editor.tsx에서 처리
          window.dispatchEvent(
            new CustomEvent("collab:user-joined", {
              detail: { userId, name, color },
            }),
          );
        },
      );

      socket.on(
        "room:user-left",
        ({ userId, name }: { userId: string; name: string }) => {
          removePresence(userId);
          window.dispatchEvent(
            new CustomEvent("collab:user-left", { detail: { userId, name } }),
          );
        },
      );

      socket.on("collab:conflict", ({ nodeId }: { nodeId: string }) => {
        window.dispatchEvent(
          new CustomEvent("collab:conflict", { detail: { nodeId } }),
        );
      });
    }

    void connect();

    return () => {
      socket?.emit("room:leave", { storyboardId });
      socket?.disconnect();
      setConnected(false);
      clearPresence();
    };
  }, [storyboardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 오프라인 중 큐에 적재하는 emit 래퍼
  const emit = useCallback(
    (
      event: string,
      data: Record<string, unknown> & { storyboardId: string },
    ) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        if (event.startsWith("node:") || event.startsWith("edge:")) {
          const op: Operation = {
            id: crypto.randomUUID(),
            type: event as Operation["type"],
            payload: data,
            clientVersion: useEditorStore.getState().contentVersion,
            timestamp: Date.now(),
            retryCount: 0,
          };
          offlineQueueRef.current.push(op);
        }
        return;
      }
      socket.emit(event, data);
    },
    [],
  );

  const updatePresence = useCallback(
    (cursor: { x: number; y: number } | null, selectedNodeIds: string[]) => {
      socketRef.current?.emit("presence:update", { cursor, selectedNodeIds });
    },
    [],
  );

  return { emit, updatePresence, socketRef };
}

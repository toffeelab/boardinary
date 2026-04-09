export interface UserPresence {
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedNodeIds: string[];
  lastSeen: number;
}

export type OperationType =
  | "node:update"
  | "node:add"
  | "node:delete"
  | "edge:add"
  | "edge:update"
  | "edge:delete";

export interface Operation {
  id: string;
  type: OperationType;
  payload: unknown;
  clientVersion: number;
  timestamp: number;
  retryCount: number;
}

export interface CollabTokenPayload {
  userId: string;
  name: string;
  exp: number;
}

export interface RoomStatePayload {
  content: Record<string, unknown> | null;
  version: number;
  presence: UserPresence[];
}

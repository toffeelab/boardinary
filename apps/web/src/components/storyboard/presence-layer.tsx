"use client";

import { useEffect } from "react";
import { useViewport } from "@xyflow/react";
import { useCollaborationStore } from "@/stores/collaboration-slice";
import type { UserPresence } from "@repo/types";

export function PresenceLayer() {
  const { x, y, zoom } = useViewport();
  const presence = useCollaborationStore((s) => s.presence);
  const removePresence = useCollaborationStore((s) => s.removePresence);
  const users = Object.values(presence);

  // 5초마다 stale presence 정리
  useEffect(() => {
    const interval = setInterval(() => {
      for (const [userId, p] of Object.entries(presence)) {
        if (Date.now() - p.lastSeen > 5000) {
          removePresence(userId);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [presence, removePresence]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 10 }}
    >
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        {users.map((user) => (
          <UserCursor key={user.userId} presence={user} zoom={zoom} />
        ))}
      </g>
    </svg>
  );
}

function UserCursor({
  presence,
  zoom,
}: {
  presence: UserPresence;
  zoom: number;
}) {
  const isStale = Date.now() - presence.lastSeen > 5000;
  const opacity = isStale ? 0 : 1;

  if (!presence.cursor) return null;

  const { x, y } = presence.cursor;
  const scale = 1 / zoom; // 줌 무관하게 커서 크기 유지

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ opacity, transition: "opacity 0.5s" }}
    >
      <g transform={`scale(${scale})`}>
        <path
          d="M0 0 L0 16 L4 12 L7 19 L9 18 L6 11 L11 11 Z"
          fill={presence.color}
          stroke="white"
          strokeWidth="1"
        />
        <foreignObject x={12} y={0} width={100} height={24}>
          <div
            style={{
              backgroundColor: presence.color,
              color: "white",
              fontSize: "11px",
              padding: "2px 6px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
              display: "inline-block",
            }}
          >
            {presence.name}
          </div>
        </foreignObject>
      </g>
    </g>
  );
}

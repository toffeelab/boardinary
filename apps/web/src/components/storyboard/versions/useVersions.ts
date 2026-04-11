"use client";

import { useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { VersionDto } from "@repo/types";
import {
  listVersions,
  createCheckpoint,
  restoreVersion as apiRestoreVersion,
  deleteVersion as apiDeleteVersion,
} from "@/lib/api-client";
import { useEditorStore } from "@/stores/editor-store";

interface UseVersionsOptions {
  storyboardId: string;
  userId: string;
  socket: Socket | null;
  onRestored?: (payload: {
    content: Record<string, unknown>;
    contentVersion: number;
    restoredBy: string;
  }) => void;
}

export function useVersions({
  storyboardId,
  userId,
  socket,
  onRestored,
}: UseVersionsOptions) {
  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setActiveSidePanel } = useEditorStore();

  const fetchVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listVersions(userId, storyboardId);
      setVersions(data ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [userId, storyboardId]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  // room:restored 소켓 이벤트 구독
  useEffect(() => {
    if (!socket) return;
    const handler = (payload: {
      content: Record<string, unknown>;
      contentVersion: number;
      restoredBy: string;
    }) => {
      onRestored?.(payload);
      void fetchVersions();
      setActiveSidePanel(null);
    };
    socket.on("room:restored", handler);
    return () => {
      socket.off("room:restored", handler);
    };
  }, [socket, onRestored, fetchVersions, setActiveSidePanel]);

  const saveCheckpoint = useCallback(
    async (label: string) => {
      await createCheckpoint(userId, storyboardId, label);
      await fetchVersions();
    },
    [userId, storyboardId, fetchVersions],
  );

  const restore = useCallback(
    async (versionId: string) => {
      await apiRestoreVersion(userId, storyboardId, versionId);
    },
    [userId, storyboardId],
  );

  const deleteVer = useCallback(
    async (versionId: string) => {
      await apiDeleteVersion(userId, storyboardId, versionId);
      await fetchVersions();
    },
    [userId, storyboardId, fetchVersions],
  );

  return {
    versions,
    isLoading,
    saveCheckpoint,
    restore,
    deleteVersion: deleteVer,
    refetch: fetchVersions,
  };
}

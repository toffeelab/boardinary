// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVersions } from "../useVersions";

vi.mock("@/lib/api-client", () => ({
  listVersions: vi.fn().mockResolvedValue([
    {
      id: "v1",
      storyboardId: "sb1",
      createdBy: "user1",
      label: null,
      contentVersion: 10,
      restoredFromId: null,
      metadata: { added: 3, removed: 0, modified: 1 },
      createdAt: "2026-04-10T14:00:00.000Z",
    },
  ]),
  restoreVersion: vi.fn().mockResolvedValue({ id: "v2" }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/stores/editor-store", () => ({
  useEditorStore: () => ({
    setActiveSidePanel: vi.fn(),
    clearHistory: vi.fn(),
  }),
}));

describe("useVersions", () => {
  it("버전 목록을 로드한다", async () => {
    const { result } = renderHook(() =>
      useVersions({ storyboardId: "sb1", userId: "user1", socket: null }),
    );
    await waitFor(() => {
      expect(result.current.versions).toHaveLength(1);
      expect(result.current.versions[0]!.id).toBe("v1");
    });
  });

  it("초기 로딩 상태는 true", () => {
    const { result } = renderHook(() =>
      useVersions({ storyboardId: "sb1", userId: "user1", socket: null }),
    );
    expect(result.current.isLoading).toBe(true);
  });
});

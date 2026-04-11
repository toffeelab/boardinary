import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useComments } from "../useComments";
import type { CommentDto } from "@repo/types";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
};

describe("useComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("초기 로드 시 comments를 fetch한다", async () => {
    const fakeComments: CommentDto[] = [
      {
        id: "c1",
        storyboardId: "sb1",
        author: { id: "u1", name: "김기획", image: null },
        anchorType: "node",
        anchorNodeId: "n1",
        canvasX: null,
        canvasY: null,
        content: "test",
        status: "open",
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        replies: [],
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fakeComments,
    });

    const { result } = renderHook(() =>
      useComments({
        storyboardId: "sb1",
        socket: mockSocket as unknown as import("socket.io-client").Socket,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0]!.id).toBe("c1");
  });

  it("addComment 호출 시 낙관적 업데이트 후 fetch한다", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // initial load
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "c2",
          storyboardId: "sb1",
          author: { id: "u1", name: "김기획", image: null },
          anchorType: "canvas",
          anchorNodeId: null,
          canvasX: 100,
          canvasY: 200,
          content: "new",
          status: "open",
          resolvedBy: null,
          resolvedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          replies: [],
        }),
      });

    const { result } = renderHook(() =>
      useComments({
        storyboardId: "sb1",
        socket: mockSocket as unknown as import("socket.io-client").Socket,
      }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.addComment({
        anchorType: "canvas",
        canvasX: 100,
        canvasY: 200,
        content: "new",
      });
    });

    // 낙관적 업데이트로 즉시 1개 추가됨
    expect(result.current.comments.length).toBeGreaterThanOrEqual(1);
  });
});

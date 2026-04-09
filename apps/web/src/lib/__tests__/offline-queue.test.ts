import { describe, it, expect } from "vitest";
import { filterQueueAfterVersion } from "../offline-queue";
import type { Operation } from "@repo/types";

const makeOp = (id: string, clientVersion: number): Operation => ({
  id,
  type: "node:update",
  payload: { id: "node1" },
  clientVersion,
  timestamp: Date.now(),
  retryCount: 0,
});

describe("filterQueueAfterVersion", () => {
  it("서버 버전 이후의 operation만 반환한다", () => {
    const ops = [
      makeOp("a", 1),
      makeOp("b", 2),
      makeOp("c", 3),
      makeOp("d", 4),
    ];
    const result = filterQueueAfterVersion(ops, 2);
    expect(result.map((o) => o.id)).toEqual(["c", "d"]);
  });

  it("서버 버전보다 큰 것이 없으면 빈 배열 반환", () => {
    const ops = [makeOp("a", 1), makeOp("b", 2)];
    const result = filterQueueAfterVersion(ops, 5);
    expect(result).toEqual([]);
  });

  it("큐가 비어있으면 빈 배열 반환", () => {
    expect(filterQueueAfterVersion([], 3)).toEqual([]);
  });

  it("모든 operation이 서버 버전보다 크면 전부 반환", () => {
    const ops = [makeOp("a", 5), makeOp("b", 6)];
    const result = filterQueueAfterVersion(ops, 4);
    expect(result.map((o) => o.id)).toEqual(["a", "b"]);
  });
});

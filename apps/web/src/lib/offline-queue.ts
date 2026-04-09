import type { Operation } from "@repo/types";

/**
 * 오프라인 큐에서 serverVersion보다 큰 clientVersion을 가진 operation만 필터링.
 * 재연결 시 서버 상태 이후의 로컬 작업만 재전송하는 데 사용.
 */
export function filterQueueAfterVersion(
  queue: Operation[],
  serverVersion: number,
): Operation[] {
  return queue.filter((op) => op.clientVersion > serverVersion);
}

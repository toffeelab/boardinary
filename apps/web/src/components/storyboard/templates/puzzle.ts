import type { StoryboardTemplate } from "./index";

export const puzzleTemplate: StoryboardTemplate = {
  id: "puzzle",
  name: "퍼즐 어드벤처",
  genre: "Puzzle",
  description:
    "퍼즐을 풀며 진행하는 어드벤처 게임 흐름. 힌트 시스템과 재시도 분기 포함.",
  nodeCount: 8,
  content: {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: "pzl-scene-1",
        type: "scene",
        position: { x: 0, y: 200 },
        data: {
          title: "퍼즐 소개",
          description:
            "고대 유적의 문이 잠겨있다. 벽면의 상형문자를 해독해야 한다.",
          color: "#8b5cf6",
          tags: ["시작", "퍼즐"],
        },
      },
      {
        id: "pzl-condition-1",
        type: "condition",
        position: { x: 250, y: 200 },
        data: {
          title: "힌트 사용 여부",
          conditionExpr: "player.hintsUsed > 0",
          color: "#ef4444",
          tags: ["힌트", "조건"],
        },
      },
      {
        id: "pzl-event-1",
        type: "event",
        position: { x: 500, y: 200 },
        data: {
          title: "퍼즐 시도",
          description:
            "플레이어가 상형문자 조합을 입력한다. 제한 시간 내에 정답을 맞춰야 한다.",
          color: "#10b981",
          tags: ["퍼즐", "시도"],
        },
      },
      {
        id: "pzl-condition-2",
        type: "condition",
        position: { x: 750, y: 200 },
        data: {
          title: "정답 여부",
          conditionExpr: "puzzle.answer === puzzle.correctAnswer",
          color: "#ef4444",
          tags: ["정답", "조건"],
        },
      },
      {
        id: "pzl-branch-1",
        type: "branch",
        position: { x: 1000, y: 200 },
        data: {
          title: "결과 분기",
          description: "정답이면 다음 스테이지로, 오답이면 재시도한다.",
          color: "#f59e0b",
          choices: [
            { id: "pzl-choice-next", label: "다음 스테이지" },
            { id: "pzl-choice-retry", label: "재시도" },
          ],
        },
      },
      {
        id: "pzl-scene-2",
        type: "scene",
        position: { x: 1250, y: 150 },
        data: {
          title: "퍼즐 클리어",
          description:
            "고대 유적의 문이 열린다. 보물이 빛나고 있다. 다음 스테이지로 이동한다.",
          color: "#8b5cf6",
          tags: ["클리어", "보물"],
        },
      },
      {
        id: "pzl-event-2",
        type: "event",
        position: { x: 500, y: 50 },
        data: {
          title: "힌트 표시",
          description:
            "플레이어에게 힌트를 제공한다. 상형문자의 일부 의미가 밝혀진다.",
          color: "#06b6d4",
          tags: ["힌트", "도움"],
        },
      },
      {
        id: "pzl-note-1",
        type: "note",
        position: { x: 1000, y: 400 },
        data: {
          title: "기획 메모",
          description:
            "난이도별 분기를 추가하세요. Easy/Normal/Hard에 따라 힌트 횟수와 제한 시간이 달라집니다.",
        },
      },
    ],
    edges: [
      { id: "pzl-e1", source: "pzl-scene-1", target: "pzl-condition-1" },
      {
        id: "pzl-e2",
        source: "pzl-condition-1",
        target: "pzl-event-1",
        sourceHandle: "true",
      },
      {
        id: "pzl-e3",
        source: "pzl-condition-1",
        target: "pzl-event-2",
        sourceHandle: "false",
      },
      {
        id: "pzl-e7",
        source: "pzl-event-2",
        target: "pzl-event-1",
      },
      { id: "pzl-e4", source: "pzl-event-1", target: "pzl-condition-2" },
      {
        id: "pzl-e5",
        source: "pzl-condition-2",
        target: "pzl-branch-1",
        sourceHandle: "true",
      },
      {
        id: "pzl-e6",
        source: "pzl-condition-2",
        target: "pzl-event-1",
        sourceHandle: "false",
      },
    ],
  },
};

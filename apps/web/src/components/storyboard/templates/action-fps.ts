import type { StoryboardTemplate } from "./index";

export const actionFpsTemplate: StoryboardTemplate = {
  id: "action-fps",
  name: "액션/FPS 미션",
  genre: "Action/FPS",
  description:
    "브리핑에서 시작해 미션을 수행하고 성공/실패로 분기하는 액션 게임 흐름",
  nodeCount: 6,
  content: {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: "fps-scene-1",
        type: "scene",
        position: { x: 0, y: 200 },
        data: {
          title: "작전 브리핑",
          description:
            "사령관이 미션 목표를 설명한다. 적 거점 침투 후 데이터 회수가 목표.",
          color: "#8b5cf6",
          tags: ["브리핑", "시작"],
        },
      },
      {
        id: "fps-event-1",
        type: "event",
        position: { x: 250, y: 200 },
        data: {
          title: "미션 시작",
          description:
            "헬기에서 강하하여 적 거점에 진입한다. 타이머가 시작된다.",
          color: "#10b981",
          tags: ["미션", "진입"],
        },
      },
      {
        id: "fps-condition-1",
        type: "condition",
        position: { x: 500, y: 200 },
        data: {
          title: "목표 달성 여부",
          conditionExpr: "mission.objectivesCompleted >= mission.totalObjectives",
          color: "#ef4444",
          tags: ["조건", "목표"],
        },
      },
      {
        id: "fps-branch-1",
        type: "branch",
        position: { x: 750, y: 200 },
        data: {
          title: "미션 결과",
          description: "미션 성공 또는 실패에 따라 결과 씬이 달라진다.",
          color: "#f59e0b",
          choices: [
            { id: "fps-choice-success", label: "성공" },
            { id: "fps-choice-fail", label: "실패" },
          ],
        },
      },
      {
        id: "fps-scene-2",
        type: "scene",
        position: { x: 1000, y: 200 },
        data: {
          title: "미션 결과",
          description:
            "성공 시 보상 획득 및 다음 미션 해금, 실패 시 재도전 선택지 제공.",
          color: "#8b5cf6",
          tags: ["결과", "보상"],
        },
      },
      {
        id: "fps-note-1",
        type: "note",
        position: { x: 500, y: 400 },
        data: {
          title: "기획 메모",
          description:
            "웨이포인트 시스템을 추가하세요. 미니맵에 목표 위치를 표시해야 합니다.",
        },
      },
    ],
    edges: [
      { id: "fps-e1", source: "fps-scene-1", target: "fps-event-1" },
      { id: "fps-e2", source: "fps-event-1", target: "fps-condition-1" },
      {
        id: "fps-e3",
        source: "fps-condition-1",
        target: "fps-branch-1",
        sourceHandle: "true",
      },
      {
        id: "fps-e4",
        source: "fps-branch-1",
        target: "fps-scene-2",
        sourceHandle: "fps-choice-success",
        label: "성공",
      },
      {
        id: "fps-e5",
        source: "fps-branch-1",
        target: "fps-scene-1",
        sourceHandle: "fps-choice-fail",
        label: "실패",
      },
    ],
  },
};

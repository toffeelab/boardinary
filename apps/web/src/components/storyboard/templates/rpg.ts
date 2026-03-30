import type { StoryboardTemplate } from "./index";

export const rpgTemplate: StoryboardTemplate = {
  id: "rpg",
  name: "RPG 어드벤처",
  genre: "RPG",
  description:
    "마을에서 시작해 퀘스트를 수락하고 던전을 탐험하는 전형적인 RPG 스토리 흐름",
  nodeCount: 8,
  content: {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: "rpg-scene-1",
        type: "scene",
        position: { x: 0, y: 200 },
        data: {
          title: "시작 마을",
          description: "평화로운 마을에서 모험이 시작된다. 마을 광장에서 NPC와 대화할 수 있다.",
          color: "#8b5cf6",
          tags: ["시작", "마을"],
        },
      },
      {
        id: "rpg-dialogue-1",
        type: "dialogue",
        position: { x: 250, y: 200 },
        data: {
          title: "NPC 대화",
          speaker: "마을 장로",
          dialogueText: "용사여, 던전에 마왕이 나타났다네. 우리 마을을 구해주게!",
          color: "#3b82f6",
          tags: ["퀘스트", "NPC"],
        },
      },
      {
        id: "rpg-branch-1",
        type: "branch",
        position: { x: 500, y: 200 },
        data: {
          title: "퀘스트 수락?",
          description: "플레이어가 퀘스트를 수락할지 결정한다.",
          color: "#f59e0b",
          choices: [
            { id: "rpg-choice-accept", label: "수락" },
            { id: "rpg-choice-decline", label: "거절" },
          ],
        },
      },
      {
        id: "rpg-scene-2",
        type: "scene",
        position: { x: 750, y: 150 },
        data: {
          title: "던전 입구",
          description: "어둡고 습한 던전 입구. 안쪽에서 괴물의 울음소리가 들린다.",
          color: "#8b5cf6",
          tags: ["던전", "탐험"],
        },
      },
      {
        id: "rpg-event-1",
        type: "event",
        position: { x: 1000, y: 150 },
        data: {
          title: "보스 전투",
          description: "던전 최심부에서 마왕과의 전투가 시작된다.",
          color: "#10b981",
          tags: ["전투", "보스"],
        },
      },
      {
        id: "rpg-branch-2",
        type: "branch",
        position: { x: 1250, y: 150 },
        data: {
          title: "전투 결과",
          description: "보스 전투의 승패에 따라 분기한다.",
          color: "#f59e0b",
          choices: [
            { id: "rpg-choice-win", label: "승리" },
            { id: "rpg-choice-lose", label: "패배" },
          ],
        },
      },
      {
        id: "rpg-scene-3",
        type: "scene",
        position: { x: 1500, y: 100 },
        data: {
          title: "엔딩 — 마을 귀환",
          description: "마왕을 물리치고 마을로 돌아온다. 마을 사람들이 환호한다.",
          color: "#8b5cf6",
          tags: ["엔딩", "귀환"],
        },
      },
      {
        id: "rpg-note-1",
        type: "note",
        position: { x: 1500, y: 300 },
        data: {
          title: "기획 메모",
          description: "보상 아이템 드롭 테이블을 추가하세요. 난이도별 보상 차등 적용 필요.",
        },
      },
    ],
    edges: [
      { id: "rpg-e1", source: "rpg-scene-1", target: "rpg-dialogue-1" },
      { id: "rpg-e2", source: "rpg-dialogue-1", target: "rpg-branch-1" },
      {
        id: "rpg-e3",
        source: "rpg-branch-1",
        target: "rpg-scene-2",
        sourceHandle: "rpg-choice-accept",
        label: "수락",
      },
      { id: "rpg-e4", source: "rpg-scene-2", target: "rpg-event-1" },
      { id: "rpg-e5", source: "rpg-event-1", target: "rpg-branch-2" },
      {
        id: "rpg-e6",
        source: "rpg-branch-2",
        target: "rpg-scene-3",
        sourceHandle: "rpg-choice-win",
        label: "승리",
      },
      {
        id: "rpg-e7",
        source: "rpg-branch-1",
        target: "rpg-scene-1",
        sourceHandle: "rpg-choice-decline",
        label: "거절",
      },
    ],
  },
};

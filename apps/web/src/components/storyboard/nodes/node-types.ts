import { SceneNode } from "./scene-node";
import { EventNode } from "./event-node";
import { BranchNode } from "./branch-node";
import { GroupNode } from "./group-node";
import { DialogueNode } from "./dialogue-node";
import { ConditionNode } from "./condition-node";
import { NoteNode } from "./note-node";

export const nodeTypes = {
  scene: SceneNode,
  event: EventNode,
  branch: BranchNode,
  group: GroupNode,
  dialogue: DialogueNode,
  condition: ConditionNode,
  note: NoteNode,
};

import type { StoryboardContentV1 } from "@repo/types";

export interface StoryboardTemplate {
  id: string;
  name: string;
  genre: string;
  description: string;
  nodeCount: number;
  content: StoryboardContentV1;
}

import { rpgTemplate } from "./rpg";
import { actionFpsTemplate } from "./action-fps";
import { puzzleTemplate } from "./puzzle";

export const templates: StoryboardTemplate[] = [
  rpgTemplate,
  actionFpsTemplate,
  puzzleTemplate,
];

export { rpgTemplate, actionFpsTemplate, puzzleTemplate };

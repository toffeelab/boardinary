import { IsEnum } from "class-validator";
import type { UpdateCommentStatusDto as IUpdateCommentStatusDto } from "@repo/types";

export class UpdateCommentStatusDto implements IUpdateCommentStatusDto {
  @IsEnum(["open", "resolved"])
  status!: "open" | "resolved";
}

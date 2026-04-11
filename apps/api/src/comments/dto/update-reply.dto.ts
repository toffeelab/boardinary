import { IsString, MaxLength } from "class-validator";
import type { UpdateReplyDto as IUpdateReplyDto } from "@repo/types";

export class UpdateReplyDto implements IUpdateReplyDto {
  @IsString()
  @MaxLength(2000)
  content!: string;
}

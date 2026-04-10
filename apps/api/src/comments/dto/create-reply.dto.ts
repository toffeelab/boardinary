import { IsString, MaxLength } from "class-validator";
import type { CreateReplyDto as ICreateReplyDto } from "@repo/types";

export class CreateReplyDto implements ICreateReplyDto {
  @IsString()
  @MaxLength(2000)
  content!: string;
}

import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  MaxLength,
} from "class-validator";
import type { CreateCommentDto as ICreateCommentDto } from "@repo/types";

export class CreateCommentDto implements ICreateCommentDto {
  @IsEnum(["node", "canvas"])
  anchorType!: "node" | "canvas";

  @IsOptional()
  @IsString()
  anchorNodeId?: string;

  @IsOptional()
  @IsNumber()
  canvasX?: number;

  @IsOptional()
  @IsNumber()
  canvasY?: number;

  @IsString()
  @MaxLength(2000)
  content!: string;
}

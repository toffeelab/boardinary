import { IsString, IsOptional, IsArray, MaxLength } from "class-validator";
import type { UpdateStoryboardDto as IUpdateStoryboardDto } from "@repo/types";

export class UpdateStoryboardDto implements IUpdateStoryboardDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  genre?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

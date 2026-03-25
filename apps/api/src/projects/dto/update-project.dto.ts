import { IsString, IsOptional, MaxLength } from "class-validator";
import type { UpdateProjectDto as IUpdateProjectDto } from "@repo/types";

export class UpdateProjectDto implements IUpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

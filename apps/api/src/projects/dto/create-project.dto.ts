import { IsString, IsOptional, MaxLength } from "class-validator";
import type { CreateProjectDto as ICreateProjectDto } from "@repo/types";

export class CreateProjectDto implements ICreateProjectDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

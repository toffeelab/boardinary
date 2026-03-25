import { IsString, IsOptional, MaxLength } from "class-validator";
import type { CreateStoryboardDto as ICreateStoryboardDto } from "@repo/types";

export class CreateStoryboardDto implements ICreateStoryboardDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  genre?: string;
}

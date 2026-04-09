import { IsObject, IsOptional, IsString } from "class-validator";
export class EdgeEventDto {
  @IsString() storyboardId!: string;
  @IsObject() @IsOptional() edge?: Record<string, unknown>;
  @IsOptional() @IsString() edgeId?: string;
}

import { IsString, IsOptional, IsIn, IsArray, IsObject } from "class-validator";

export class CreateBlueprintDto {
  @IsIn(["preset", "flow"])
  type!: "preset" | "flow";

  @IsIn(["personal", "organization"])
  scope!: "personal" | "organization";

  @IsOptional()
  @IsString()
  orgId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

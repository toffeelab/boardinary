import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsObject,
  IsNotEmpty,
  MaxLength,
} from "class-validator";

export class CreateBlueprintDto {
  @IsIn(["preset", "flow"])
  type!: "preset" | "flow";

  @IsIn(["personal", "organization"])
  scope!: "personal" | "organization";

  @IsOptional()
  @IsString()
  orgId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
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

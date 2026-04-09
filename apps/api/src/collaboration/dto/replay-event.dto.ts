import { IsArray, IsString } from "class-validator";
export class ReplayEventDto {
  @IsString() storyboardId!: string;
  @IsArray() ops!: unknown[];
}

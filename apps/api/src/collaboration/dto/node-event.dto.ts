import { IsObject, IsOptional, IsString } from "class-validator";
export class NodeEventDto {
  @IsString() storyboardId!: string;
  @IsObject() node!: Record<string, unknown>;
  @IsOptional() @IsString() nodeId?: string;
}

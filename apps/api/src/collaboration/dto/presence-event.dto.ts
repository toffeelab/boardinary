import { IsArray, IsOptional, IsObject } from "class-validator";
export class PresenceEventDto {
  @IsOptional() @IsObject() cursor?: { x: number; y: number } | null;
  @IsArray() selectedNodeIds!: string[];
}

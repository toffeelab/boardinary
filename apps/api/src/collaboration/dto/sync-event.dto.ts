import { IsNumber, IsString } from "class-validator";
export class SyncEventDto {
  @IsString() storyboardId!: string;
  @IsNumber() version!: number;
}

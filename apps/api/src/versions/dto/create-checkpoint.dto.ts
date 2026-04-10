import { IsString, MaxLength } from "class-validator";

export class CreateCheckpointDto {
  @IsString()
  @MaxLength(100)
  label!: string;
}

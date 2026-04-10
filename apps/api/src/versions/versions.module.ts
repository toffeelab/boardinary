import { Module } from "@nestjs/common";
import { VersionsController } from "./versions.controller";
import { VersionsService } from "./versions.service";
import { StoryboardsModule } from "../storyboards/storyboards.module";
import { CollaborationModule } from "../collaboration/collaboration.module";

@Module({
  imports: [StoryboardsModule, CollaborationModule],
  controllers: [VersionsController],
  providers: [VersionsService],
  exports: [VersionsService],
})
export class VersionsModule {}

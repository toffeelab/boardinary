import { Module } from "@nestjs/common";
import { StoryboardsController } from "./storyboards.controller";
import { StoryboardsService } from "./storyboards.service";
import { ProjectsModule } from "../projects/projects.module";
import { OrganizationsModule } from "../organizations/organizations.module";

@Module({
  imports: [ProjectsModule, OrganizationsModule],
  controllers: [StoryboardsController],
  providers: [StoryboardsService],
})
export class StoryboardsModule {}

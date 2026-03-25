import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { OrganizationsService } from "../organizations/organizations.service";
import { ProjectsService } from "../projects/projects.service";
import { StoryboardsService } from "./storyboards.service";
import { CreateStoryboardDto } from "./dto/create-storyboard.dto";
import { UpdateStoryboardDto } from "./dto/update-storyboard.dto";

@Controller()
export class StoryboardsController {
  constructor(
    private readonly storyboardsService: StoryboardsService,
    private readonly projectsService: ProjectsService,
    private readonly orgsService: OrganizationsService,
  ) {}

  @Get("organizations/:orgSlug/projects/:projectSlug/storyboards")
  async list(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    const project = await this.projectsService.getProjectBySlug(
      org.id,
      projectSlug,
    );
    return this.storyboardsService.getStoryboardsByProjectId(project.id);
  }

  @Post("organizations/:orgSlug/projects/:projectSlug/storyboards")
  async create(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateStoryboardDto,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    const project = await this.projectsService.getProjectBySlug(
      org.id,
      projectSlug,
    );
    return this.storyboardsService.createStoryboard(project.id, userId, body);
  }

  @Get("storyboards/:id")
  async getById(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    return this.storyboardsService.getStoryboardById(id);
  }

  @Patch("storyboards/:id")
  async update(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: UpdateStoryboardDto,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    return this.storyboardsService.updateStoryboard(id, userId, body);
  }

  @Delete("storyboards/:id")
  async delete(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    await this.storyboardsService.deleteStoryboard(id);
  }
}

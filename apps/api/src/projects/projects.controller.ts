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
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Controller("organizations/:orgSlug/projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly orgsService: OrganizationsService,
  ) {}

  @Get()
  async list(
    @Param("orgSlug") orgSlug: string,
    @CurrentUserId() userId: string,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    return this.projectsService.getProjectsByOrgId(org.id);
  }

  @Post()
  async create(
    @Param("orgSlug") orgSlug: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateProjectDto,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    return this.projectsService.createProject(org.id, body);
  }

  @Get(":projectSlug")
  async getBySlug(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    return this.projectsService.getProjectBySlug(org.id, projectSlug);
  }

  @Patch(":projectSlug")
  async update(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
    @Body() body: UpdateProjectDto,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    const project = await this.projectsService.getProjectBySlug(
      org.id,
      projectSlug,
    );
    return this.projectsService.updateProject(project.id, body);
  }

  @Delete(":projectSlug")
  async delete(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @CurrentUserId() userId: string,
  ) {
    const org = await this.orgsService.ensureOrgMember(orgSlug, userId);
    const project = await this.projectsService.getProjectBySlug(
      org.id,
      projectSlug,
    );
    await this.projectsService.deleteProject(project.id);
  }
}

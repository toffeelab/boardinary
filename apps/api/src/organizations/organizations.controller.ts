import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return this.orgsService.getOrganizationsByUserId(userId);
  }

  @Get(":orgSlug")
  async getBySlug(
    @Param("orgSlug") orgSlug: string,
    @CurrentUserId() userId: string,
  ) {
    return this.orgsService.ensureOrgMember(orgSlug, userId);
  }
}

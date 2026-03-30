import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { BlueprintsService } from "./blueprints.service";
import { CreateBlueprintDto } from "./dto/create-blueprint.dto";
import { UpdateBlueprintDto } from "./dto/update-blueprint.dto";

@Controller("blueprints")
export class BlueprintsController {
  constructor(private readonly blueprintsService: BlueprintsService) {}

  @Get()
  async getBlueprints(
    @CurrentUserId() userId: string,
    @Query("scope") scope: string,
    @Query("orgId") orgId?: string,
  ) {
    return this.blueprintsService.getBlueprints(userId, scope, orgId);
  }

  @Get(":id")
  async getBlueprint(@Param("id") id: string) {
    return this.blueprintsService.getBlueprintById(id);
  }

  @Post()
  async createBlueprint(
    @CurrentUserId() userId: string,
    @Body() dto: CreateBlueprintDto,
  ) {
    return this.blueprintsService.createBlueprint(userId, dto);
  }

  @Patch(":id")
  async updateBlueprint(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBlueprintDto,
  ) {
    return this.blueprintsService.updateBlueprint(id, userId, dto);
  }

  @Delete(":id")
  async deleteBlueprint(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
  ) {
    return this.blueprintsService.deleteBlueprint(id, userId);
  }
}

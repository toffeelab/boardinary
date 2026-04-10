import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { VersionsService } from "./versions.service";
import { StoryboardsService } from "../storyboards/storyboards.service";
import { CreateCheckpointDto } from "./dto/create-checkpoint.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CollaborationService } from "../collaboration/collaboration.service";
import type { VersionRestoredEvent } from "@repo/types";

@Controller("storyboards/:storyboardId/versions")
export class VersionsController {
  constructor(
    private readonly versionsService: VersionsService,
    private readonly storyboardsService: StoryboardsService,
    private readonly collaborationService: CollaborationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async listVersions(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);
    return this.versionsService.listVersions(storyboardId);
  }

  @Get(":versionId")
  async getVersion(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);
    return this.versionsService.getVersionById(versionId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCheckpoint(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
    @Body() dto: CreateCheckpointDto,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);

    // clientVersion=-1 forces content to always be returned (version never equals -1)
    const state = await this.collaborationService.getRoomState(
      storyboardId,
      -1,
    );
    const content = state.content ?? {
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [],
      edges: [],
    };

    return this.versionsService.createSnapshot(
      storyboardId,
      content as Record<string, unknown>,
      state.version,
      dto.label,
      userId,
    );
  }

  @Post(":versionId/restore")
  @HttpCode(HttpStatus.CREATED)
  async restoreVersion(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);

    const { snapshot, contentVersion } =
      await this.versionsService.restoreVersion(
        storyboardId,
        versionId,
        userId,
      );

    await this.collaborationService.initRoomFromDb(storyboardId, true);

    const event: VersionRestoredEvent = {
      storyboardId,
      content: snapshot.content as Record<string, unknown>,
      contentVersion,
      restoredBy: userId,
    };
    this.eventEmitter.emit("version.restored", event);

    return snapshot;
  }

  @Delete(":versionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVersion(
    @CurrentUserId() userId: string,
    @Param("storyboardId") storyboardId: string,
    @Param("versionId") versionId: string,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(storyboardId, userId);
    await this.versionsService.deleteVersion(versionId);
  }
}

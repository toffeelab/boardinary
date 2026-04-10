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
import { StoryboardsService } from "../storyboards/storyboards.service";
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CreateReplyDto } from "./dto/create-reply.dto";
import { UpdateCommentStatusDto } from "./dto/update-comment-status.dto";
import { UpdateReplyDto } from "./dto/update-reply.dto";

@Controller()
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly storyboardsService: StoryboardsService,
  ) {}

  @Get("storyboards/:id/comments")
  async list(@Param("id") id: string, @CurrentUserId() userId: string) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    return this.commentsService.getCommentsByStoryboard(id);
  }

  @Post("storyboards/:id/comments")
  async create(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateCommentDto,
  ) {
    await this.storyboardsService.ensureStoryboardAccess(id, userId);
    return this.commentsService.createComment(id, userId, body);
  }

  @Patch("comments/:id/status")
  async updateStatus(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: UpdateCommentStatusDto,
  ) {
    return this.commentsService.updateCommentStatus(id, userId, body);
  }

  @Delete("comments/:id")
  async delete(@Param("id") id: string, @CurrentUserId() userId: string) {
    await this.commentsService.deleteComment(id, userId);
    return { ok: true };
  }

  @Post("comments/:id/replies")
  async createReply(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: CreateReplyDto,
  ) {
    return this.commentsService.createReply(id, userId, body);
  }

  @Patch("replies/:id")
  async updateReply(
    @Param("id") id: string,
    @CurrentUserId() userId: string,
    @Body() body: UpdateReplyDto,
  ) {
    return this.commentsService.updateReply(id, userId, body);
  }

  @Delete("replies/:id")
  async deleteReply(@Param("id") id: string, @CurrentUserId() userId: string) {
    await this.commentsService.deleteReply(id, userId);
    return { ok: true };
  }
}

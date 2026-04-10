import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AuthModule } from "./auth/auth.module";
import { BlueprintsModule } from "./blueprints/blueprints.module";
import { CollaborationModule } from "./collaboration/collaboration.module";
import { CommentsModule } from "./comments/comments.module";
import { HealthController } from "./health.controller";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ProjectsModule } from "./projects/projects.module";
import { StoryboardsModule } from "./storyboards/storyboards.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    StoryboardsModule,
    BlueprintsModule,
    CollaborationModule,
    CommentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

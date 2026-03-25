import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
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
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    StoryboardsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

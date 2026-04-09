import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import Redis from "ioredis";
import { CollaborationGateway } from "./collaboration.gateway";
import { CollaborationService } from "./collaboration.service";
import { CollaborationRedisService } from "./collaboration-redis.service";
import { WsAuthGuard } from "./guards/ws-auth.guard";
import { StoryboardsModule } from "../storyboards/storyboards.module";

@Module({
  imports: [ConfigModule, StoryboardsModule, ScheduleModule.forRoot()],
  providers: [
    {
      provide: "REDIS_CLIENT",
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>("REDIS_URL") ?? "redis://localhost:6379"),
      inject: [ConfigService],
    },
    {
      provide: CollaborationRedisService,
      useFactory: (redis: Redis) => new CollaborationRedisService(redis),
      inject: ["REDIS_CLIENT"],
    },
    CollaborationService,
    CollaborationGateway,
    WsAuthGuard,
  ],
})
export class CollaborationModule {}

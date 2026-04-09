import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(Reflector) private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // WS 컨텍스트는 WsAuthGuard가 처리 — 전역 HTTP Guard 스킵
    if (context.getType() === "ws") return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const rawSecret = request.headers["x-internal-secret"];
    const rawUserId = request.headers["x-user-id"];

    const secret = Array.isArray(rawSecret) ? rawSecret[0] : rawSecret;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    const expectedSecret = this.configService.get<string>(
      "INTERNAL_API_SECRET",
    );

    if (!secret || secret !== expectedSecret) {
      throw new UnauthorizedException("Invalid internal secret");
    }

    if (!userId) {
      throw new UnauthorizedException("Missing user ID");
    }

    request.userId = userId;
    return true;
  }
}

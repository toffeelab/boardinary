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
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const secret = request.headers["x-internal-secret"];
    const userId = request.headers["x-user-id"];

    const expectedSecret =
      this.configService.get<string>("INTERNAL_API_SECRET");

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

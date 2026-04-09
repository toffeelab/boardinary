import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import type { Socket } from "socket.io";
import type { CollabTokenPayload } from "@repo/types";

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth["token"] as string | undefined;

    if (!token) throw new UnauthorizedException("Missing collab token");

    const payload = this.verifyToken(token);
    if (!payload) throw new UnauthorizedException("Invalid collab token");

    // 소켓에 userId, name 저장 (이후 핸들러에서 참조)
    client.data["userId"] = payload.userId;
    client.data["name"] = payload.name;
    return true;
  }

  verifyToken(token: string): CollabTokenPayload | null {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, sig] = parts as [string, string];
    const secret = this.config.get<string>("INTERNAL_API_SECRET") ?? "";
    const expected = createHmac("sha256", secret)
      .update(payloadB64)
      .digest("hex");

    if (sig !== expected) return null;

    let payload: CollabTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      ) as CollabTokenPayload;
    } catch {
      return null;
    }

    if (Date.now() > payload.exp) return null;
    return payload;
  }
}

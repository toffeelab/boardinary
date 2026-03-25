import { Controller, Post, Body } from "@nestjs/common";
import { UsersService } from "./users.service";
import type { SetupUserDto } from "@repo/types";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post("setup")
  async setup(@Body() body: SetupUserDto) {
    await this.usersService.setupUser(body.userId, body.name);
    return { success: true };
  }
}

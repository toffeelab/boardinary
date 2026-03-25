import { Injectable } from "@nestjs/common";
import { db, organizations, orgMembers } from "@repo/db";
import { and, eq } from "drizzle-orm";

@Injectable()
export class UsersService {
  async setupUser(userId: string, name: string | null) {
    const slug =
      name?.toLowerCase().replace(/\s+/g, "-") ?? `user-${userId.slice(0, 8)}`;

    await db.transaction(async (tx) => {
      let [org] = await tx
        .insert(organizations)
        .values({
          name: `${name ?? "내"}의 워크스페이스`,
          slug: `${slug}-${userId.slice(0, 6)}`,
          ownerId: userId,
          isPersonal: true,
        })
        .onConflictDoNothing()
        .returning();

      if (!org) {
        [org] = await tx
          .select()
          .from(organizations)
          .where(
            and(
              eq(organizations.ownerId, userId),
              eq(organizations.isPersonal, true),
            ),
          )
          .limit(1);
      }

      if (org) {
        await tx
          .insert(orgMembers)
          .values({ orgId: org.id, userId, role: "owner" })
          .onConflictDoNothing();
      }
    });
  }
}

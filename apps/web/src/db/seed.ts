import { db } from "./index";
import {
  users,
  organizations,
  orgMembers,
  projects,
  storyboards,
} from "./schema";

const DEFAULT_USER_ID = "local-user";

async function seed() {
  console.log("Seeding database...");

  // 기본 사용자
  const [user] = await db
    .insert(users)
    .values({
      id: DEFAULT_USER_ID,
      name: "로컬 개발자",
      email: "dev@boardinary.local",
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.log("User already exists, skipping...");
    return;
  }

  // 개인 조직
  const [org] = await db
    .insert(organizations)
    .values({
      name: "로컬 개발자의 워크스페이스",
      slug: "local-dev",
      ownerId: user.id,
      isPersonal: true,
    })
    .returning();

  // 멤버십
  await db.insert(orgMembers).values({
    orgId: org!.id,
    userId: user.id,
    role: "owner",
  });

  // 샘플 프로젝트
  const [project] = await db
    .insert(projects)
    .values({
      orgId: org!.id,
      name: "판타지 RPG 메인 퀘스트",
      slug: "fantasy-rpg-main-quest",
      description: "판타지 RPG의 메인 퀘스트 스토리보드",
    })
    .returning();

  // 샘플 스토리보드
  await db.insert(storyboards).values([
    {
      projectId: project!.id,
      createdBy: user.id,
      updatedBy: user.id,
      name: "1장: 시작의 마을",
      description: "플레이어가 처음 시작하는 마을의 이벤트 흐름",
      genre: "RPG",
      content: {},
      contentVersion: 0,
    },
    {
      projectId: project!.id,
      createdBy: user.id,
      updatedBy: user.id,
      name: "2장: 첫 던전",
      description: "마을 외곽 동굴 던전 탐험",
      genre: "RPG",
      content: {},
      contentVersion: 0,
    },
  ]);

  console.log("Seed complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  });

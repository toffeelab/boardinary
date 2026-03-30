/**
 * Boardinary 프로젝트 고유 ESLint 규칙
 *
 * 아키텍처 불변 조건을 기계적으로 강제한다.
 * 에러 메시지에 수정 방법을 포함하여 에이전트 컨텍스트에 지침을 주입한다.
 *
 * @see ARCHITECTURE.md
 * @type {import("eslint").Linter.Config[]}
 */
export const boardinaryRules = [
  // 1+3. DB 직접 import 금지 + apps/ 간 직접 import 금지 (통합)
  //       같은 files 패턴에서 no-restricted-imports를 두 번 정의하면 뒤의 것만 적용되므로 통합 필수.
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: [
      "apps/web/src/data-access/**",
      "apps/web/src/actions/**",
      "apps/web/src/db/**",
      "apps/web/src/test/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@repo/db", "@repo/db/*"],
              message:
                "DB는 data-access 레이어를 통해 접근하세요. 직접 import 금지. → ARCHITECTURE.md#불변-조건",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/*"],
              message:
                "Drizzle ORM은 data-access/db 레이어에서만 사용하세요. → ARCHITECTURE.md#레이어-구조",
            },
            {
              group: ["../../apps/api/*", "../../apps/docs/*", "../../../apps/api/*", "../../../apps/docs/*"],
              message:
                "apps/ 간 직접 import 금지. 공유 코드는 packages/로 추출하세요. → ARCHITECTURE.md#불변-조건",
            },
          ],
        },
      ],
    },
  },

  // 2. console.log 커밋 금지 (테스트 파일 제외)
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.*", "**/*.spec.*", "**/test/**"],
    rules: {
      "no-console": [
        "error",
        {
          allow: ["warn", "error"],
        },
      ],
    },
  },
];

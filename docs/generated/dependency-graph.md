# Dependency Graph

> 자동 생성 문서 — 직접 수정하지 마세요.
> 생성일: 2026-03-30

## Workspace Packages

- **web** → @repo/db, @repo/types, @repo/ui, @repo/eslint-config, @repo/typescript-config
- **api** → @repo/db, @repo/types, @repo/eslint-config, @repo/typescript-config
- **docs** → @repo/ui, @repo/eslint-config, @repo/typescript-config
- **@repo/db** → @repo/typescript-config
- **@repo/eslint-config** → none
- **@repo/types** → @repo/typescript-config
- **@repo/typescript-config** → none
- **@repo/ui** → @repo/eslint-config, @repo/typescript-config

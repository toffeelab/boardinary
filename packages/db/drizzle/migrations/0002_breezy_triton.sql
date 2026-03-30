CREATE TYPE "public"."blueprint_scope" AS ENUM('personal', 'organization', 'project');--> statement-breakpoint
CREATE TYPE "public"."blueprint_type" AS ENUM('preset', 'flow', 'template');--> statement-breakpoint
CREATE TABLE "blueprints" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "blueprint_type" NOT NULL,
	"scope" "blueprint_scope" NOT NULL,
	"created_by" text NOT NULL,
	"org_id" text,
	"project_id" text,
	"name" text NOT NULL,
	"description" text,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_version" integer DEFAULT 1 NOT NULL,
	"tags" text[] DEFAULT '{}'::text[],
	"icon" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_blueprints_personal" ON "blueprints" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_blueprints_org" ON "blueprints" USING btree ("org_id","type");--> statement-breakpoint
CREATE INDEX "idx_blueprints_tags" ON "blueprints" USING gin ("tags");

ALTER TABLE blueprints ADD CONSTRAINT chk_blueprints_scope CHECK (
  (scope = 'personal'     AND org_id IS NULL     AND project_id IS NULL) OR
  (scope = 'organization' AND org_id IS NOT NULL AND project_id IS NULL) OR
  (scope = 'project'      AND org_id IS NOT NULL AND project_id IS NOT NULL)
);

ALTER TABLE blueprints ADD CONSTRAINT chk_blueprints_name_length
  CHECK (char_length(name) BETWEEN 1 AND 200);

CREATE TRIGGER trg_blueprints_updated_at
  BEFORE UPDATE ON blueprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
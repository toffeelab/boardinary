CREATE TABLE "storyboard_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"storyboard_id" text NOT NULL,
	"created_by" text,
	"label" text,
	"content" jsonb NOT NULL,
	"content_version" integer NOT NULL,
	"restored_from_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storyboard_versions" ADD CONSTRAINT "storyboard_versions_storyboard_id_storyboards_id_fk" FOREIGN KEY ("storyboard_id") REFERENCES "public"."storyboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storyboard_versions" ADD CONSTRAINT "storyboard_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sv_content_version" ON "storyboard_versions" USING btree ("storyboard_id","content_version");--> statement-breakpoint
CREATE INDEX "idx_sv_list" ON "storyboard_versions" USING btree ("storyboard_id","created_at");
CREATE INDEX IF NOT EXISTS "idx_sv_auto_retention"
ON "storyboard_versions" ("storyboard_id", "created_at" ASC)
WHERE "label" IS NULL;
CREATE TYPE "public"."anchor_type" AS ENUM('node', 'canvas');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TABLE "comment_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"storyboard_id" text NOT NULL,
	"author_id" text NOT NULL,
	"anchor_type" "anchor_type" NOT NULL,
	"anchor_node_id" text,
	"canvas_x" double precision,
	"canvas_y" double precision,
	"content" text NOT NULL,
	"status" "comment_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "anchor_node_check" CHECK ((anchor_type = 'node' AND anchor_node_id IS NOT NULL AND canvas_x IS NULL AND canvas_y IS NULL)
        OR (anchor_type = 'canvas' AND anchor_node_id IS NULL AND canvas_x IS NOT NULL AND canvas_y IS NOT NULL)),
	CONSTRAINT "resolved_pair_check" CHECK ((resolved_by IS NULL) = (resolved_at IS NULL))
);
--> statement-breakpoint
ALTER TABLE "comment_replies" ADD CONSTRAINT "comment_replies_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_replies" ADD CONSTRAINT "comment_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_storyboard_id_storyboards_id_fk" FOREIGN KEY ("storyboard_id") REFERENCES "public"."storyboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_replies_comment_created" ON "comment_replies" USING btree ("comment_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_comments_storyboard_status" ON "comments" USING btree ("storyboard_id","status");--> statement-breakpoint
CREATE INDEX "idx_comments_storyboard_created" ON "comments" USING btree ("storyboard_id","created_at");
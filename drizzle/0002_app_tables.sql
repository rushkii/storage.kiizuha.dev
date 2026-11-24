CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"folder_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"size" bigint NOT NULL,
	"content_type" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "folder" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"category_id" text,
	"name" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_access" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_type" text NOT NULL,
	"item_id" text NOT NULL,
	"open_count" integer DEFAULT 0 NOT NULL,
	"last_opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"root_folder_id" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "share_item" (
	"share_id" text NOT NULL,
	"file_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"folder_id" text NOT NULL,
	"file_id" text NOT NULL,
	"key" text NOT NULL,
	"upload_id" text NOT NULL,
	"file_name" text NOT NULL,
	"size" bigint NOT NULL,
	"last_modified" bigint NOT NULL,
	"content_type" text NOT NULL,
	"part_size" integer NOT NULL,
	"completed_parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_parent_id_folder_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_access" ADD CONSTRAINT "item_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_root_folder_id_folder_id_fk" FOREIGN KEY ("root_folder_id") REFERENCES "public"."folder"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_item" ADD CONSTRAINT "share_item_share_id_share_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_item" ADD CONSTRAINT "share_item_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_user_name_uq" ON "category" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "file_user_folder_idx" ON "file" USING btree ("user_id","folder_id");--> statement-breakpoint
CREATE INDEX "folder_user_parent_idx" ON "folder" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE INDEX "folder_user_category_idx" ON "folder" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "folder_root_name_uq" ON "folder" USING btree ("user_id","category_id","name") WHERE "folder"."parent_id" is null and "folder"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "folder_child_name_uq" ON "folder" USING btree ("user_id","parent_id","name") WHERE "folder"."parent_id" is not null and "folder"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "item_access_user_item_uq" ON "item_access" USING btree ("user_id","item_type","item_id");--> statement-breakpoint
CREATE INDEX "item_access_user_opened_idx" ON "item_access" USING btree ("user_id","last_opened_at");--> statement-breakpoint
CREATE INDEX "share_user_idx" ON "share" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "share_item_pk" ON "share_item" USING btree ("share_id","file_id");--> statement-breakpoint
CREATE INDEX "share_item_file_idx" ON "share_item" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "upload_session_user_idx" ON "upload_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upload_session_activity_idx" ON "upload_session" USING btree ("last_activity_at");
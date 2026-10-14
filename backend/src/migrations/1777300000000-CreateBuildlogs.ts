import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBuildlogs1777300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "buildlogs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "project_id" uuid NULL,
        "text" text NOT NULL,
        "image_urls" text NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_buildlogs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_buildlogs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_buildlogs_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_buildlogs_user_id" ON "buildlogs" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_buildlogs_project_id" ON "buildlogs" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_buildlogs_created_at" ON "buildlogs" ("created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "buildlogs"`);
  }
}

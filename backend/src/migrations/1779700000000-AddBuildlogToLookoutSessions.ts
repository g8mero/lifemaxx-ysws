import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBuildlogToLookoutSessions1779700000000
  implements MigrationInterface
{
  name = 'AddBuildlogToLookoutSessions1779700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lookout_sessions" ADD COLUMN "buildlog_id" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "lookout_sessions"
      ADD CONSTRAINT "FK_lookout_sessions_buildlog" FOREIGN KEY ("buildlog_id")
        REFERENCES "buildlogs"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    // One Lookout session per buildlog (multiple unattached sessions allowed).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_lookout_sessions_buildlog"
        ON "lookout_sessions" ("buildlog_id") WHERE "buildlog_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_lookout_sessions_buildlog"`);
    await queryRunner.query(
      `ALTER TABLE "lookout_sessions" DROP CONSTRAINT "FK_lookout_sessions_buildlog"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lookout_sessions" DROP COLUMN "buildlog_id"`,
    );
  }
}

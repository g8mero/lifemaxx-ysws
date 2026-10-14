import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBuildlogReview1782700000000 implements MigrationInterface {
    async up(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE "buildlogs" ADD COLUMN IF NOT EXISTS "approved" boolean NOT NULL DEFAULT false`);
        await q.query(`ALTER TABLE "buildlogs" ADD COLUMN IF NOT EXISTS "approved_hours" real`);
        await q.query(`ALTER TABLE "buildlogs" ADD COLUMN IF NOT EXISTS "approved_by_reviewer_id" uuid`);
        await q.query(`ALTER TABLE "buildlogs" ADD COLUMN IF NOT EXISTS "approved_at" timestamptz`);
    }

    async down(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE "buildlogs" DROP COLUMN IF EXISTS "approved_at"`);
        await q.query(`ALTER TABLE "buildlogs" DROP COLUMN IF EXISTS "approved_by_reviewer_id"`);
        await q.query(`ALTER TABLE "buildlogs" DROP COLUMN IF EXISTS "approved_hours"`);
        await q.query(`ALTER TABLE "buildlogs" DROP COLUMN IF EXISTS "approved"`);
    }
}
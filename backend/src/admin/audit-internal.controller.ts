import { Controller, Get, Param, ParseUUIDPipe, UseGuards, NotFoundException } from '@nestjs/common';
import { AuditServiceKeyGuard } from './audit-service-key.guard';
import { IframeContextService } from './iframe-context.service';
import { BuildlogsService } from '../buildlogs/buildlogs.service';
import { LookoutService } from '../lookout/lookout.service';
/**
 * Internal, shared-key-gated route the private audit service calls to exchange
 * an opaque iframe ctx for its payload. Separate from AdminController so the
 * `/api/internal/...` prefix and the key-only guard stay clearly isolated from
 * the user-facing admin routes.
 */
@Controller('api/internal/audit')
export class AuditInternalController {
  constructor(
    private readonly contexts: IframeContextService,
    private readonly buildlogsService: BuildlogsService,   // ← add
    private readonly lookoutService: LookoutService,   // ← add
  ) {}

  @UseGuards(AuditServiceKeyGuard)
  @Get('context/:ctx')
  resolveContext(@Param('ctx') ctx: string) {
    const payload = this.contexts.consume(ctx);
    if (!payload) {
      // 404 → the audit service treats this as "expired/already used".
      throw new NotFoundException('context not found');
    }
    return payload;
  }

  /**
   * Buildlogs + Lookout evidence for a project, for the second-pass audit service.
   * Same shared-key gate as context resolution. `projectId` comes from the ctx
   * payload the audit service already resolved, so no new identifier is exposed.
   */
  @UseGuards(AuditServiceKeyGuard)
  @Get('project/:projectId/buildlogs')
  async getProjectBuildlogs(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const [buildlogs, lookout, approvedBuildlogHours] = await Promise.all([
      // isSuperAdmin=true: the audit pass is super-admin-only, so full names are fine.
      this.buildlogsService.findByProject(projectId, true),
      this.lookoutService.listForProjectReview(projectId),
      this.buildlogsService.approvedHoursForProject(projectId),
    ]);
    return {
      buildlogs,
      lookout,
      approvedBuildlogHours,
      totalLapseSeconds: lookout.totalTrackedSeconds,
    };
  }
}

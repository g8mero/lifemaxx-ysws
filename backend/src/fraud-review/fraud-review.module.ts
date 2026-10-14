import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { User } from '../entities/user.entity';
import { Buildlog } from '../entities/buildlog.entity';
import { FraudReview } from '../entities/fraud-review.entity';
import { ProjectReview } from '../entities/project-review.entity';
import { Submission } from '../entities/submission.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ProjectAirtableSyncModule } from '../projects/project-airtable-sync.module';
import { RsvpModule } from '../rsvp/rsvp.module';
import { SlackModule } from '../slack/slack.module';
import { SettingsModule } from '../settings/settings.module';
import { FraudReviewService } from './fraud-review.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, User, Buildlog, FraudReview, ProjectReview, Submission]),
    AuditLogModule,
    ProjectAirtableSyncModule,
    RsvpModule,
    SlackModule,
    SettingsModule,
  ],
  providers: [FraudReviewService],
  exports: [FraudReviewService],
})
export class FraudReviewModule {}

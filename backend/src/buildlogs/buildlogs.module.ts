import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { LookoutModule } from '../lookout/lookout.module';
import { Buildlog } from '../entities/buildlog.entity';
import { Project } from '../entities/project.entity';
import { BuildlogsController } from './buildlogs.controller';
import { BuildlogsService } from './buildlogs.service';

@Module({
  imports: [
    AuthModule,
    AuditLogModule,
    LookoutModule,
    TypeOrmModule.forFeature([Buildlog, Project]),
  ],
  controllers: [BuildlogsController],
  providers: [BuildlogsService],
  exports: [BuildlogsService],
})
export class BuildlogsModule {}

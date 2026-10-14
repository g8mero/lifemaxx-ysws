import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SlackService } from './slack.service';
import { SlackNotifyService } from './slack-notify.service';
import { SlackController } from './slack.controller';

@Module({
  imports: [AuthModule],
  controllers: [SlackController],
  providers: [SlackService, SlackNotifyService],
  exports: [SlackService, SlackNotifyService],
})
export class SlackModule {}

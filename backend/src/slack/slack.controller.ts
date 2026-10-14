import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SlackService } from './slack.service';

@Controller('api/slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) {}

  /** The signed-in user's Slack profile photo, for their avatar in the dashboard. */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Get('avatar')
  async avatar(@Req() req: Request) {
    const slackId = (req as any).user?.slack_id;
    const url = slackId ? await this.slackService.getUserAvatar(slackId) : null;
    return { url };
  }
}

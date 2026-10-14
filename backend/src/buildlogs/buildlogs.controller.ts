import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BuildlogsService } from './buildlogs.service';
import { CreateBuildlogDto } from './create-buildlog.dto';

@Controller('api/buildlogs')
export class BuildlogsController {
  constructor(private readonly buildlogsService: BuildlogsService) {}

  /** List the current user's buildlogs, newest first. */
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: Request) {
    const user = (req as any).user;
    if (!user?.uid) throw new UnauthorizedException('No user identity');
    return this.buildlogsService.findByUser(user.uid);
  }

  /** Create a new buildlog. Optional image upload via base64 data URIs. */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateBuildlogDto) {
    const user = (req as any).user;
    if (!user?.uid) throw new UnauthorizedException('No user identity');
    return this.buildlogsService.create(user.uid, dto);
  }

  /** Delete one of the current user's buildlogs. */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    if (!user?.uid) throw new UnauthorizedException('No user identity');
    return this.buildlogsService.deleteOwn(user.uid, id);
  }
}

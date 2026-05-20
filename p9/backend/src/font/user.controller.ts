import { Controller, Get, Post, Put, Delete, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { FontService } from './font.service';
import type { User, ShareLink, TypographyConfig, FontMetadata } from './font.interface';

@Controller('api/user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly fontService: FontService,
  ) {}

  @Get('profile')
  getProfile(): { success: boolean; data: User } {
    const user = this.userService.getDefaultUser();
    return { success: true, data: user };
  }

  @Put('profile')
  updateProfile(@Body() updates: Partial<User>): { success: boolean; data: User | null } {
    const user = this.userService.getDefaultUser();
    const updated = this.userService.updateUser(user.id, updates);
    return { success: true, data: updated || null };
  }

  @Get('fonts')
  getUserFonts(): { success: boolean; data: FontMetadata[] } {
    const fonts = this.fontService.getAllFonts();
    return { success: true, data: fonts };
  }

  @Get('configs')
  getUserConfigs(): { success: boolean; data: TypographyConfig[] } {
    const configs = this.fontService.getAllConfigs();
    return { success: true, data: configs };
  }

  @Post('share/:configId')
  createShareLink(@Param('configId') configId: string): { success: boolean; data: ShareLink } {
    const config = this.fontService.getConfigById(configId);
    if (!config) {
      throw new HttpException('Config not found', HttpStatus.NOT_FOUND);
    }
    const link = this.userService.createShareLink(configId);
    return { success: true, data: link };
  }

  @Get('share/:shareCode')
  getSharedConfig(@Param('shareCode') shareCode: string): { success: boolean; data: { config: TypographyConfig; font: FontMetadata | null } } | null {
    const link = this.userService.getShareLinkByCode(shareCode);
    if (!link) {
      throw new HttpException('Share link not found', HttpStatus.NOT_FOUND);
    }
    const config = this.fontService.getConfigById(link.configId);
    if (!config) {
      throw new HttpException('Config not found', HttpStatus.NOT_FOUND);
    }
    const font = config.fontId ? this.fontService.getFontById(config.fontId) || null : null;
    return { success: true, data: { config, font } };
  }

  @Get('shares')
  getShareLinks(): { success: boolean; data: ShareLink[] } {
    const links = this.userService.getUserShareLinks();
    return { success: true, data: links };
  }

  @Delete('share/:shareId')
  deleteShareLink(@Param('shareId') shareId: string): { success: boolean } {
    const result = this.userService.deleteShareLink(shareId);
    if (!result) {
      throw new HttpException('Share link not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  @Get('stats')
  getStats(): {
    success: boolean;
    data: {
      fontCount: number;
      configCount: number;
      shareCount: number;
    };
  } {
    const fonts = this.fontService.getAllFonts();
    const configs = this.fontService.getAllConfigs();
    const shares = this.userService.getUserShareLinks();

    return {
      success: true,
      data: {
        fontCount: fonts.length,
        configCount: configs.length,
        shareCount: shares.length,
      },
    };
  }
}

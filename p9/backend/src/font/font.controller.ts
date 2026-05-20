import { Controller, Post, Get, Delete, Param, Body, UseInterceptors, UploadedFile, HttpException, HttpStatus, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { FontService } from './font.service';
import { CopyrightService } from '../services/copyright.service';
import { UserService } from '../services/user.service';
import { TypographyConfig } from './font.interface';
import { Response } from 'express';
import * as path from 'path';

@Controller('api')
export class FontController {
  constructor(
    private readonly fontService: FontService,
    private readonly copyrightService: CopyrightService,
    private readonly userService: UserService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('font', {
    storage: diskStorage({
      destination: './uploads/temp',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['.ttf', '.otf', '.woff', '.woff2'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new HttpException('Invalid file type. Only TTF, OTF, WOFF, WOFF2 are allowed.', HttpStatus.BAD_REQUEST), false);
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  }))
  async uploadFont(@UploadedFile() file: Express.Multer.File) {
    try {
      const copyrightInfo = this.copyrightService.analyzeFont(file.path);
      const copyrightWarning = this.copyrightService.generateCopyrightWarning(copyrightInfo);

      const metadata = await this.fontService.processFontFile(file);
      metadata.copyright = copyrightInfo;

      const user = this.userService.getDefaultUser();
      metadata.userId = user.id;
      this.userService.addUserFont(user.id, metadata.id);

      this.fontService['saveData']();

      return {
        success: true,
        data: metadata,
        copyrightWarning,
      };
    } catch (error) {
      throw new HttpException(`Failed to process font: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('fonts')
  getAllFonts() {
    return {
      success: true,
      data: this.fontService.getAllFonts(),
    };
  }

  @Get('fonts/:id')
  getFontById(@Param('id') id: string) {
    const font = this.fontService.getFontById(id);
    if (!font) {
      throw new HttpException('Font not found', HttpStatus.NOT_FOUND);
    }
    return {
      success: true,
      data: font,
    };
  }

  @Delete('fonts/:id')
  deleteFont(@Param('id') id: string) {
    const user = this.userService.getDefaultUser();
    this.userService.removeUserFont(user.id, id);
    const result = this.fontService.deleteFont(id);
    if (!result) {
      throw new HttpException('Font not found', HttpStatus.NOT_FOUND);
    }
    return {
      success: true,
      message: 'Font deleted successfully',
    };
  }

  @Post('configs')
  saveConfig(@Body() config: TypographyConfig) {
    const user = this.userService.getDefaultUser();
    config.userId = user.id;
    const saved = this.fontService.saveConfig(config);
    this.userService.addUserConfig(user.id, saved.id!);
    return {
      success: true,
      data: saved,
    };
  }

  @Get('configs')
  getAllConfigs() {
    return {
      success: true,
      data: this.fontService.getAllConfigs(),
    };
  }

  @Get('configs/:id')
  getConfigById(@Param('id') id: string) {
    const config = this.fontService.getConfigById(id);
    if (!config) {
      throw new HttpException('Config not found', HttpStatus.NOT_FOUND);
    }
    return {
      success: true,
      data: config,
    };
  }

  @Delete('configs/:id')
  deleteConfig(@Param('id') id: string) {
    const user = this.userService.getDefaultUser();
    this.userService.removeUserConfig(user.id, id);
    const result = this.fontService.deleteConfig(id);
    if (!result) {
      throw new HttpException('Config not found', HttpStatus.NOT_FOUND);
    }
    return {
      success: true,
      message: 'Config deleted successfully',
    };
  }

  @Get('configs/:id/export')
  exportConfig(@Param('id') id: string, @Res() res: Response) {
    const config = this.fontService.getConfigById(id);
    if (!config) {
      throw new HttpException('Config not found', HttpStatus.NOT_FOUND);
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${config.name || 'typography'}.json"`);
    res.send(JSON.stringify(config, null, 2));
  }

  @Get('fonts/:id/download/:format')
  downloadFont(
    @Param('id') id: string,
    @Param('format') format: string,
    @Res() res: Response
  ) {
    const font = this.fontService.getFontById(id);
    if (!font) {
      throw new HttpException('Font not found', HttpStatus.NOT_FOUND);
    }

    let fileName: string;
    let contentType: string;

    switch (format.toLowerCase()) {
      case 'woff2':
        if (!font.optimized?.woff2) {
          throw new HttpException('WOFF2 format not available', HttpStatus.NOT_FOUND);
        }
        fileName = font.optimized.woff2;
        contentType = 'font/woff2';
        break;
      case 'otf':
        if (!font.optimized?.otf) {
          throw new HttpException('OTF format not available', HttpStatus.NOT_FOUND);
        }
        fileName = font.optimized.otf;
        contentType = 'font/otf';
        break;
      case 'original':
        fileName = font.fileName;
        contentType = font.originalFormat === 'ttf' ? 'font/ttf' : 'font/otf';
        break;
      default:
        throw new HttpException('Invalid format. Use woff2, otf, or original', HttpStatus.BAD_REQUEST);
    }

    const filePath = path.join(process.cwd(), 'uploads', fileName);
    if (!require('fs').existsSync(filePath)) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${font.name}.${format === 'original' ? font.originalFormat : format}"`);
    res.sendFile(filePath);
  }

  @Post('configs/:id/share')
  shareConfig(@Param('id') configId: string) {
    const config = this.fontService.getConfigById(configId);
    if (!config) {
      throw new HttpException('Config not found', HttpStatus.NOT_FOUND);
    }

    const shareCode = Math.random().toString(36).substring(2, 10);
    const shareLink = {
      id: shareCode,
      shareCode,
      configId,
      views: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    this.userService.addShareLink('default-user', shareLink);

    return {
      success: true,
      data: shareLink,
    };
  }

  @Get('share/:shareCode')
  getSharedConfig(@Param('shareCode') shareCode: string) {
    const shareLink = this.userService.getShareLinkByCode(shareCode);
    if (!shareLink) {
      throw new HttpException('Share link not found or expired', HttpStatus.NOT_FOUND);
    }

    this.userService.incrementShareViews(shareCode);

    const config = this.fontService.getConfigById(shareLink.configId);
    if (!config) {
      throw new HttpException('Config not found', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      data: config,
    };
  }
}

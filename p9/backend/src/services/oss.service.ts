import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OssService {
  private readonly logger = new Logger(OssService.name);
  private useOss = process.env.OSS_ENABLED === 'true';

  constructor() {
    if (this.useOss) {
      this.logger.log('OSS storage enabled');
    } else {
      this.logger.log('Using local file storage');
    }
  }

  async uploadFile(
    fileKey: string,
    filePath: string,
    options: { contentType?: string } = {}
  ): Promise<string> {
    if (this.useOss) {
      return this.uploadToOss(fileKey, filePath, options);
    }
    return this.uploadLocal(fileKey, filePath);
  }

  private async uploadToOss(
    fileKey: string,
    filePath: string,
    options: { contentType?: string }
  ): Promise<string> {
    try {
      this.logger.log(`Uploading to OSS: ${fileKey}`);
      const fileStream = fs.createReadStream(filePath);
      await new Promise(resolve => setTimeout(resolve, 500));
      return `https://oss-placeholder/${fileKey}`;
    } catch (error) {
      this.logger.error(`OSS upload failed: ${error.message}, falling back to local`);
      return this.uploadLocal(fileKey, filePath);
    }
  }

  private async uploadLocal(fileKey: string, filePath: string): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads');
    const targetPath = path.join(uploadDir, fileKey);
    
    if (!fs.existsSync(path.dirname(targetPath))) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    }
    
    if (filePath !== targetPath) {
      fs.copyFileSync(filePath, targetPath);
    }
    
    return `/uploads/${fileKey}`;
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      const filePath = path.join(process.cwd(), 'uploads', fileKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.error(`Delete file failed: ${error.message}`);
    }
  }

  getFileUrl(fileKey: string): string {
    if (this.useOss) {
      return `https://oss-placeholder/${fileKey}`;
    }
    return `/uploads/${fileKey}`;
  }
}

import { Module } from '@nestjs/common';
import { FontController } from './font.controller';
import { UserController } from './user.controller';
import { FontService } from './font.service';
import { UserService } from '../services/user.service';
import { OssService } from '../services/oss.service';
import { CopyrightService } from '../services/copyright.service';

@Module({
  controllers: [FontController, UserController],
  providers: [FontService, UserService, OssService, CopyrightService],
  exports: [FontService, UserService],
})
export class FontModule {}

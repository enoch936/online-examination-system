import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get('local/:key')
  async serveFile(@Param('key') key: string, @Res({ passthrough: true }) response: Response) {
    const stream = this.storage.getFileStream(key);
    response.set({ 'Content-Type': 'application/octet-stream' });
    return stream;
  }
} 

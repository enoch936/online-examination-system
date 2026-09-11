import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { StorageService } from './storage.service';

@ApiBearerAuth()
@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('local/:key')
  async serveFile(@Param('key') key: string, @Res({ passthrough: true }) response: Response) {
    const stream = this.storage.getFileStream(key);
    response.set({ 'Content-Type': 'application/octet-stream' });
    return stream;
  }
} 

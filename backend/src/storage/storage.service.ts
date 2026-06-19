import { Injectable, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Injectable()
export class StorageService {
  constructor() {
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async getSignedUploadUrl(key: string) {
    return {
      key,
      url: `/api/v1/storage/local/${encodeURIComponent(key)}`,
      expiresInSeconds: 900,
    };
  }

  async uploadFile(key: string, buffer: Buffer): Promise<string> {
    const filePath = join(UPLOAD_DIR, key);
    const dir = join(filePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, buffer);
    return `/api/v1/storage/local/${encodeURIComponent(key)}`;
  }

  getFileStream(key: string): StreamableFile {
    const filePath = join(UPLOAD_DIR, key);
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    const stream = createReadStream(filePath);
    return new StreamableFile(stream);
  }
}

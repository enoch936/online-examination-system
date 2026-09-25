import { Injectable, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * DEVELOPMENT STORAGE BACKEND.
 *
 * Writes to the local filesystem (`<cwd>/uploads`) and serves files through
 * this process — it is not suitable for production (ephemeral disks on
 * Render, no CDN, no signed URLs). This class is the single seam to replace
 * with an S3/R2-compatible provider: swap the three methods below without
 * touching callers.
 */
const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Injectable()
export class StorageService {
  constructor() {
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        'WARNING: StorageService is using local disk storage in production. Files will be lost on redeploy; configure an object-storage provider instead.',
      );
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

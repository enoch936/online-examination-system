import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { safeJoinWithin } from '../common/utils/path.util';

/**
 * DEVELOPMENT STORAGE BACKEND.
 *
 * Writes to the local filesystem (`<cwd>/uploads`) and serves files through
 * this process — it is not suitable for production (ephemeral disks on
 * Render, no CDN, no signed URLs). This class is the single seam to replace
 * with an S3/R2-compatible provider: swap the three methods below without
 * touching callers.
 */
const UPLOAD_DIR = resolve(process.cwd(), 'uploads');

/**
 * Resolve a caller-supplied key to a safe absolute path that is guaranteed to
 * live inside {@link UPLOAD_DIR}. Throws for path-traversal primitives and
 * absolute-path escape attempts.
 */
function sanitizeKey(key: string): string {
  const filePath = safeJoinWithin(UPLOAD_DIR, key);
  if (filePath === null) {
    throw new BadRequestException('Invalid storage key');
  }
  return filePath;
}

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
    sanitizeKey(key);
    return {
      key,
      url: `/api/v1/storage/local/${encodeURIComponent(key)}`,
      expiresInSeconds: 900,
    };
  }

  async uploadFile(key: string, buffer: Buffer): Promise<string> {
    const filePath = sanitizeKey(key);
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, buffer);
    return `/api/v1/storage/local/${encodeURIComponent(key)}`;
  }

  getFileStream(key: string): StreamableFile {
    const filePath = sanitizeKey(key);
    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }
    const stream = createReadStream(filePath);
    return new StreamableFile(stream);
  }
}
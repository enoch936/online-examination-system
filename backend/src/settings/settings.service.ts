import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic() {
    const settings = await this.prisma.platformSetting.findMany({
      where: { isPublic: true },
    });
    const map = new Map(settings.map((setting) => [setting.key, setting.value]));
    return {
      environment: map.get('ENVIRONMENT') ?? null,
      jwtAccessExpiry: map.get('JWT_ACCESS_EXPIRES_IN') ?? null,
      jwtRefreshExpiry: map.get('JWT_REFRESH_EXPIRES_IN') ?? null,
      rateLimit: map.get('RATE_LIMIT_LIMIT') ?? null,
    };
  }
}

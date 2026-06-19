import { RoleName } from '@prisma/client';

export type AuthenticatedUser = {
  sub: string;
  email: string;
  roles: RoleName[];
  permissions: string[];
};

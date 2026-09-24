import { SetMetadata } from '@nestjs/common';
import { vai_tro_nguoi_dung } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: vai_tro_nguoi_dung[]) =>
  SetMetadata(ROLES_KEY, roles);

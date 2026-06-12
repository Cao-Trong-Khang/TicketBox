import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from './rbac.constants';

export function Permissions(...permissions: string[]) {
  return SetMetadata(PERMISSIONS_KEY, permissions);
}

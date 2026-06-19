import { IsIn } from 'class-validator';
import { ROLE_CODES } from '../rbac.constants';

const FIXED_ROLE_CODES = Object.values(ROLE_CODES);

export class AssignRoleDto {
  @IsIn(FIXED_ROLE_CODES)
  role_code!: string;
}

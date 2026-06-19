export type RoleCode = 'AUDIENCE' | 'ORGANIZER' | 'GATE_STAFF';

export type UserProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  status: string;
  roles: RoleCode[];
};

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
};

export type RegisterInput = {
  fullName: string;
  phone?: string;
  email: string;
  password: string;
};

export type RegisteredUser = UserProfile;

export type RefreshResponse = LoginResponse;

export type RoleWithPermissions = {
  id: string;
  code: RoleCode;
  name: string;
  permissions: string[];
};

export type UserRoleAssignment = {
  code: RoleCode;
  name: string;
  assigned_at: string;
};

export type GateStaffAssignment = {
  id: string;
  concert_id: string;
  user_id: string;
  gate_label: string;
  assigned_at: string;
};

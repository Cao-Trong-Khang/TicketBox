export type LoginInput = {
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  roles: string[];
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type AuthProfile = {
  id: string;
  email: string;
  roles: string[];
};

export type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

export type RegisteredUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
};
export type JwtPayload = {
  user_id: string;
  roles: string[];
  exp?: number;
};

export type AuthenticatedUser = {
  id: string;
  roles: string[];
};

export type PublicUser = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  status: string;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  user: PublicUser;
};

export type JwtPayload = {
  sub: string;
  email: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type AuthProfile = {
  id: string;
  email: string;
  roles: string[];
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

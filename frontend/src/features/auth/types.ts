export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
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

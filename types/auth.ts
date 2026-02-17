export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: { id: string; email: string } | null;
  loading: boolean;
}

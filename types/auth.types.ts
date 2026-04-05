export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  prestigeCount: number;
  createdAt: string;
}

export interface AuthState {
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  session: { access_token: string; refresh_token: string } | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
}

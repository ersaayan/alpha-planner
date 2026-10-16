export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  prestigeCount: number;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email?: string;
}

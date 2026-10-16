/**
 * Test helpers for builds with sync configured. The Supabase client module is mocked
 * in jest.setup.ts with sync OFF; these flip it on and give it a fake client.
 */

type MockClientModule = { isSyncConfigured: boolean; supabase: unknown };

function clientModule(): MockClientModule {
  return jest.requireMock('@/services/supabase/client') as MockClientModule;
}

export function createMockSupabase() {
  const query = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    eq: jest.fn().mockResolvedValue({ error: null }),
    gt: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    query,
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    from: jest.fn().mockReturnValue(query),
    rpc: jest.fn().mockResolvedValue({ error: null }),
  };
}

/** Turns sync on (with a fresh fake client) or off for the current test file. */
export function setSyncConfigured(configured: boolean) {
  const mod = clientModule();
  mod.isSyncConfigured = configured;
  mod.supabase = configured ? createMockSupabase() : null;
  return mod.supabase as ReturnType<typeof createMockSupabase> | null;
}

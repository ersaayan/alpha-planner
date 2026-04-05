# Alpha Planner — Full Overhaul Design Spec

**Tarih:** 2026-04-05
**Kapsam:** Supabase entegrasyonu, Pomodoro bug fix, gün sonu özet, gamification overhaul, kod kalitesi iyileştirmeleri, test altyapısı, i18n
**Kullanıcılar:** 2 kişi (kişisel kullanım, mağazada yayınlanmayacak)

---

## 1. Supabase & Auth

### 1.1 Auth Akışı

- Email/password kayıt ve giriş
- Kayıt sırasında ek bilgi: `display_name` (zorunlu)
- Uygulama içinde kişiselleştirme: "Hoşgeldin Fatma" gibi karşılama mesajları
- Token persistence: AsyncStorage üzerinden (`supabase-js` built-in)
- Her kullanıcı tamamen bağımsız veri alanına sahip (RLS ile izolasyon)
- Onboarding akışı güncellenir: Giriş/Kayıt ekranı → mevcut onboarding → ana uygulama

### 1.2 Veritabanı Şeması

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- ============================================================
-- TABLES
-- ============================================================

-- Kullanıcı profili (auth.users ile 1:1)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  app_settings JSONB NOT NULL DEFAULT '{}',
  pomodoro_settings JSONB NOT NULL DEFAULT '{}',
  gamification_state JSONB NOT NULL DEFAULT '{}',
  prestige_count INTEGER NOT NULL DEFAULT 0,
  prestige_history JSONB NOT NULL DEFAULT '[]',
  locale TEXT NOT NULL DEFAULT 'tr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kategoriler
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Görevler
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  estimated_pomodoros INTEGER,
  pomodoro_sessions INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Alt görevler
CREATE TABLE subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  todo_id UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Pomodoro oturumları
CREATE TABLE pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
  phase TEXT NOT NULL CHECK (phase IN ('focus', 'short_break', 'long_break')),
  duration INTEGER NOT NULL,
  target_duration INTEGER NOT NULL,
  was_completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  paused_duration INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Açılmış başarımlar
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Günlük istatistikler
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pomodoros_completed INTEGER NOT NULL DEFAULT 0,
  focus_time INTEGER NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  daily_quests_completed INTEGER NOT NULL DEFAULT 0,
  summary_shown_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Günlük görevler
CREATE TABLE daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quest_type TEXT NOT NULL,
  quest_params JSONB NOT NULL DEFAULT '{}',
  target_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  xp_reward INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, quest_type)
);

-- Haftalık hedefler
CREATE TABLE weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('system', 'personal')),
  goal_params JSONB NOT NULL DEFAULT '{}',
  target_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  xp_reward INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start, goal_type, (goal_params->>'metric'))
);

-- ============================================================
-- INDEXES
-- Best practice: Postgres FK'leri otomatik indexlemez.
-- Tüm user_id FK'leri + sık sorgulanan kolonlar indexlenmeli.
-- Soft delete olan tablolarda partial index kullanılır.
-- ============================================================

-- profiles: PK zaten indexed, JSONB kolonlarına GIN index
CREATE INDEX idx_profiles_gamification_state ON profiles USING GIN (gamification_state);

-- categories: FK + soft delete partial index
CREATE INDEX idx_categories_user_id ON categories (user_id) WHERE deleted_at IS NULL;

-- todos: FK'ler + status/priority/due_date sorgu indexleri (soft delete partial)
CREATE INDEX idx_todos_user_id_status ON todos (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_todos_user_id_due_date ON todos (user_id, due_date) WHERE deleted_at IS NULL AND due_date IS NOT NULL;
CREATE INDEX idx_todos_category_id ON todos (category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_todos_user_id_priority ON todos (user_id, priority) WHERE deleted_at IS NULL;

-- subtasks: FK'ler (soft delete partial)
CREATE INDEX idx_subtasks_todo_id ON subtasks (todo_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_subtasks_user_id ON subtasks (user_id) WHERE deleted_at IS NULL;

-- pomodoro_sessions: FK'ler + zaman bazlı sorgular
CREATE INDEX idx_pomodoro_sessions_user_id ON pomodoro_sessions (user_id);
CREATE INDEX idx_pomodoro_sessions_user_started ON pomodoro_sessions (user_id, started_at DESC);
CREATE INDEX idx_pomodoro_sessions_todo_id ON pomodoro_sessions (todo_id) WHERE todo_id IS NOT NULL;

-- achievements: FK + achievement_id lookup
CREATE INDEX idx_achievements_user_id ON achievements (user_id);

-- daily_stats: composite (user_id, date) — UNIQUE constraint zaten index oluşturur ama
-- sıralı sorgular için DESC index ekliyoruz
CREATE INDEX idx_daily_stats_user_date_desc ON daily_stats (user_id, date DESC);

-- daily_quests: composite index
CREATE INDEX idx_daily_quests_user_date ON daily_quests (user_id, date DESC);

-- weekly_goals: composite index
CREATE INDEX idx_weekly_goals_user_week ON weekly_goals (user_id, week_start DESC);

-- ============================================================
-- UPDATED_AT TRIGGERS (moddatetime extension)
-- Otomatik olarak updated_at kolonunu günceller
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subtasks
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON daily_stats
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON daily_quests
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON weekly_goals
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- auth.users'a kayıt olunca otomatik profil oluşturur
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- Best practice: (SELECT auth.uid()) ile cache'lenir (5-10x hız)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON profiles
  FOR ALL USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "users_own_data" ON categories
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON todos
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON subtasks
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON pomodoro_sessions
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON achievements
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON daily_stats
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON daily_quests
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "users_own_data" ON weekly_goals
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================
-- SOFT DELETE CLEANUP (30 gün sonra hard delete)
-- pg_cron extension ile çalışır
-- ============================================================
-- Not: pg_cron migration'da enable edilecek, ardından:
-- SELECT cron.schedule('cleanup-soft-deletes', '0 3 * * *', $$
--   DELETE FROM categories WHERE deleted_at < now() - interval '30 days';
--   DELETE FROM subtasks WHERE deleted_at < now() - interval '30 days';
--   DELETE FROM todos WHERE deleted_at < now() - interval '30 days';
-- $$);
```

**Supabase Postgres Best Practices Uygulamaları:**

| Best Practice | Uygulama |
|---------------|----------|
| **RLS policy caching** | `(SELECT auth.uid())` ile subselect cache — her satır için fonksiyon çağrısı yerine tek çağrı (5-10x hız) |
| **WITH CHECK clause** | INSERT/UPDATE için ayrı WITH CHECK — sadece USING yetersiz, veri yazma güvenliği |
| **FK index'leri** | Tüm `user_id`, `todo_id`, `category_id` FK'lerine explicit index — Postgres bunları otomatik indexlemez |
| **Partial index (soft delete)** | `WHERE deleted_at IS NULL` — Sadece aktif kayıtlar indexlenir, index boyutu küçülür (5-20x) |
| **Composite index** | `(user_id, status)`, `(user_id, date DESC)` — Çoklu kolon sorgularında tek index yeterli |
| **GIN index (JSONB)** | `gamification_state` JSONB'ye GIN index — JSONB sorgularında 10-100x hız |
| **moddatetime trigger** | `updated_at` otomatik güncelleme — Uygulama seviyesinde unutulma riski yok |
| **Profile auto-create** | `auth.users` INSERT trigger — Kayıt sonrası profil garantili |
| **SECURITY DEFINER + search_path** | Trigger fonksiyonu izole — Schema injection koruması |
| **text over varchar(n)** | Tüm string kolonlar `TEXT` — Aynı performans, yapay limit yok |
| **timestamptz over timestamp** | Tüm zaman kolonları `TIMESTAMPTZ` — Timezone-aware |
| **Soft delete cron cleanup** | pg_cron ile 30 günlük hard delete — Disk alanı yönetimi |

### 1.3 Sync Mimarisi (Offline-First)

**Write Path:**
1. Kullanıcı aksiyonu → Zustand store güncelle (lokal) → AsyncStorage persist
2. Sync queue'ya ekle (pending operations listesi)
3. Debounced push (500ms bekle, batch olarak Supabase'e gönder)
4. Başarılı → queue'dan sil; Başarısız → retry queue'da tut (exponential backoff, max 3 retry)

**Read Path:**
1. App foreground'a geldiğinde → Supabase'den `updated_at > lastSyncedAt` olan kayıtları çek
2. Lokal store'a merge et
3. `lastSyncedAt` güncelle

**Conflict Resolution:**
- `updated_at` karşılaştırması, son yazan kazanır (last-write-wins)
- 2 kullanıcı birbirinin verisine erişemediği için cross-user conflict yok

**Soft Delete:**
- Tüm tablolarda `deleted_at` alanı
- Silme işlemi `deleted_at = now()` set eder
- Query'ler `WHERE deleted_at IS NULL` filtresi kullanır
- 30 gün sonra hard delete (cron veya Supabase Edge Function)

**Sync State:**
```typescript
interface SyncState {
  lastSyncedAt: string | null;
  pendingOperations: SyncOperation[];
  isSyncing: boolean;
  lastError: string | null;
}

interface SyncOperation {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}
```

---

## 2. Pomodoro Bildirim Zamanlama Bug Fix

### 2.1 Kök Neden

Timer state'inde birden fazla zaman kaynağı var:
- `remainingTime` (countdown)
- `startedAt` (başlangıç zamanı)
- `pausedAt` / `pausedDuration`

Bu değerler arasında tutarsızlık olduğunda bildirim yanlış zamanda tetikleniyor.

### 2.2 Çözüm: Single Source of Truth

Timer'ın bitişi şu formülle hesaplanır:
```
completionTime = startedAt + totalTime + totalPausedDuration
```

**Kurallar:**
- `remainingTime` her zaman `completionTime - now()` olarak hesaplanır (derived state)
- Bildirim her zaman `completionTime` anına zamanlanır
- Pause başladığında `pausedAt = now()`, resume'da `totalPausedDuration += now() - pausedAt`
- Background task timer'ı ilerlettikten sonra bildirimi yeniden zamanlar
- Rehydration sırasında aynı `completionTime` formülü kullanılır

### 2.3 Etkilenen Dosyalar

- `stores/pomodoro-store.ts` — Timer state refactor
- `services/background/background-task.ts` — Sync + bildirim yeniden zamanlama
- `services/background/pomodoro-task.ts` — Bildirim zamanlama hesabı
- `app/_layout.tsx` — Rehydration mantığı

---

## 3. Gün Sonu Özet Sistemi

### 3.1 Bildirim (23:00)

- Her gün saat 23:00'te local push notification
- Mesaj: "Günün özeti hazır! Bugün X pomodoro, Y dakika focus, Z görev tamamladın"
- Tıklayınca uygulamaya yönlendirir, özet modal'ı tetikler
- `expo-notifications` scheduled notification ile (repeating daily)

### 3.2 Modal Özet

Uygulama açıldığında, bugünün özeti henüz gösterilmediyse modal gösterilir.

**Gösterilen Metrikler:**
| Metrik | Açıklama |
|--------|----------|
| Toplam focus süresi | Saat:Dakika formatında |
| Tamamlanan pomodoro | Sayı |
| Tamamlanan görev | Sayı (+ subtask sayısı) |
| En çok çalışılan kategori | Kategori adı + süre |
| Kazanılan XP | Toplam gün içi XP |
| Streak durumu | "7 gün devam ediyor" veya "Kırıldı!" |
| Combo çarpanı | Mevcut daily combo (ör. "2x") |
| Günlük görevler | 2/3 tamamlandı gibi |
| Haftalık hedefe ilerleme | Progress bar + yüzde |
| Dünle karşılaştırma | "+2 pomodoro, -15dk focus" gibi delta |
| Motivasyon mesajı | Veriye göre dinamik (iyi/orta/kötü gün) |

**Davranış:**
- Günde 1 kez gösterilir (`daily_stats.summary_shown_at` TIMESTAMPTZ alanına kaydedilir)
- "Kapat" butonu ile kapatılır
- 23:00-23:59 arası veya ertesi gün ilk açılışta gösterilir
- Animasyonlu girişle açılır (stat'lar sayarak artar)

### 3.3 Motivasyon Mesajları

Gün performansına göre 3 kademe:
- **Harika gün** (hedefe ulaşıldı / ortalamanın üstü): "Bugün harika bir iş çıkardın!"
- **Normal gün** (ortalama civarı): "İyi bir gün oldu, devam et!"
- **Düşük gün** (ortalamanın altı): "Her gün aynı olmaz, yarın daha güçlü!"

---

## 4. Gamification Overhaul

### 4.1 XP Ekonomisi

**Yeni XP Değerleri (düşürüldü):**
| Aksiyon | Eski | Yeni |
|---------|------|------|
| Pomodoro tamamlama | 25 | 15 |
| Görev tamamlama | 10 | 8 |
| Subtask tamamlama | 3 | 2 |
| Daily streak devam | 50 | 30 |
| Achievement (değişken) | 25-1000 | Aynı kalır (yeni başarımlara dağılır) |
| Daily quest tamamlama | — | 20 per quest, 30 bonus hepsi tamamlanınca |
| Weekly goal tamamlama | — | 100 per goal |

**50 Seviye Sistemi (exponential):**

Seviyeler doğa temalı devam eder, 5 tier'a bölünür:

| Tier | Seviyeler | XP Aralığı | Tema |
|------|-----------|-------------|------|
| Seedling | 1-10 | 0 - 500 | Tohum → Filiz |
| Sapling | 11-20 | 500 - 2,500 | Fidan büyümesi |
| Tree | 21-30 | 2,500 - 8,000 | Ağaç olgunlaşması |
| Forest | 31-40 | 8,000 - 20,000 | Orman genişlemesi |
| Ancient | 41-50 | 20,000 - 50,000 | Kadim orman |

XP formülü: `xpRequired(level) = Math.floor(50 * (level ^ 1.8))`

### 4.2 Başarımlar (82 adet, 9 kategori)

**Pomodoro Başarımları (12):**
- First Focus: 1 pomodoro tamamla
- Getting Started: 5 pomodoro
- Focus Apprentice: 25 pomodoro
- Focus Adept: 50 pomodoro
- Focus Expert: 100 pomodoro
- Focus Master: 250 pomodoro
- Focus Legend: 500 pomodoro
- Focus Mythic: 1000 pomodoro
- Marathon Runner: Bir günde 8 pomodoro
- Iron Focus: Bir günde 12 pomodoro
- Session Combo x5: 5 üst üste pomodoro (stop etmeden)
- Session Combo x10: 10 üst üste pomodoro

**Görev Başarımları (10):**
- Task Starter: 1 görev tamamla
- Task Doer: 10 görev
- Task Achiever: 50 görev
- Task Master: 100 görev
- Task Legend: 250 görev
- Task Mythic: 500 görev
- Subtask Slayer: 100 subtask tamamla
- Urgent Handler: 10 urgent görev tamamla
- Clean Slate: Bir günde tüm pending görevleri tamamla
- Category Specialist: Bir kategoride 50 görev tamamla

**Streak Başarımları (10):**
- 3 Day Streak
- Week Warrior: 7 gün
- Two Week Streak: 14 gün
- Monthly Dedication: 30 gün
- Two Month Streak: 60 gün
- Quarter Master: 90 gün
- Half Year Hero: 180 gün
- Year Legend: 365 gün
- Comeback: Streak kırıldıktan sonra 7 günlük yeni streak
- Unbreakable: 30 gün streak kırmadan (reset sonrası dahil)

**Focus Time Başarımları (8):**
- First Hour: Toplam 1 saat focus
- Ten Hours: 10 saat
- Day's Work: 50 saat (bir iş haftası)
- Hundred Hours: 100 saat
- Five Hundred: 500 saat
- Thousand Hours: 1000 saat
- Deep Worker: Bir günde 4 saat focus
- Night Shift: 00:00-05:00 arası pomodoro tamamla

**Combo Başarımları (8):**
- Combo Starter: 3x session combo
- Combo Adept: 5x session combo
- Combo Master: 10x session combo
- Daily Combo 3: 3 gün daily combo
- Daily Combo 7: 7 gün daily combo
- Daily Combo 14: 14 gün daily combo
- Daily Combo 30: 30 gün daily combo
- Double Trouble: Session combo + daily combo aynı anda aktif

**Daily Quest Başarımları (8):**
- Quest Beginner: İlk daily quest tamamla
- Quest Regular: 10 gün tüm quest'leri tamamla
- Quest Veteran: 30 gün tüm quest'leri tamamla
- Quest Master: 100 gün tüm quest'leri tamamla
- Perfect Week: 7 gün üst üste tüm daily quest tamamla
- Perfect Month: 30 gün üst üste tüm daily quest tamamla
- Speed Runner: Saat 12:00'den önce tüm daily quest'leri tamamla
- Last Minute: Saat 23:00'den sonra son quest'i tamamla

**Kategori Başarımları (6):**
- Category Explorer: 3 farklı kategoride görev tamamla
- Category Specialist: Bir kategoride 50 görev tamamla
- Category Master: Bir kategoride 100 görev tamamla
- All Rounder: Tüm kategorilerde en az 10'ar görev tamamla
- Organizer: 5+ kategori oluştur
- Color Collector: 5 farklı renkte kategori oluştur

**Milestone Başarımları (8):**
- First Day: İlk aktif gün
- One Week In: 7 gün uygulamayı kullan
- One Month In: 30 gün uygulamayı kullan
- Hundred Days: 100 gün
- Half Year: 180 gün
- One Year: 365 gün
- XP Collector: Toplam 10,000 XP kazan
- XP Hoarder: Toplam 50,000 XP kazan

**Özel / Gizli Başarımlar (12):**
- Early Bird: 07:00'den önce pomodoro tamamla
- Night Owl: 23:00'den sonra pomodoro tamamla
- Weekend Warrior: Cumartesi + Pazar aktif ol
- Midnight Oil: Gece yarısı (00:00) civarında pomodoro tamamla
- First Prestige: İlk prestige'e ulaş
- Prestige III: 3. prestige
- Prestige V: 5. prestige
- Max Level: Seviye 50'ye ulaş
- Speed Leveler: 1 haftada 10 seviye atla
- Perfectionist: Bir görevin tüm subtask'larını tamamla (min 5 subtask)
- Overachiever: Bir günde hem tüm daily quest'leri hem weekly goal'u tamamla
- Zen Master: 7 gün üst üste tüm break'leri atlamadan tamamla

**Nadirlik Seviyeleri:**
- Common: 25-50 XP ödül
- Rare: 75-150 XP ödül
- Epic: 200-500 XP ödül
- Legendary: 750-1500 XP ödül

### 4.3 Seasonal Prestige (Aylık)

**Reset Mekanizması:**
- Her ayın 1'i saat 00:00'da tetiklenir
- Sıfırlananlar: Seviye → 1, currentXp → 0
- Korunanlar: Başarımlar, streak, toplam istatistikler (totalPomodoros, totalFocusTime, vb.), prestige sayısı, tüm geçmiş veriler

**Ay Sonu Ödülleri:**
Önceki ayın performansına göre otomatik özel başarım/rozet:

| Koşul | Ödül | XP |
|-------|------|----|
| 100+ pomodoro | "[Ay] Odak Şampiyonu" | 500 |
| 50+ görev tamamlama | "[Ay] Görev Ustası" | 300 |
| 20+ gün aktif | "[Ay] Sadık Savaşçı" | 400 |
| 30 gün streak | "[Ay] Mükemmel Ay" | 1000 |
| Seviye 30+ | "[Ay] Hızlı Yükselici" | 250 |
| Tüm daily quest %80+ | "[Ay] Görev Avcısı" | 350 |

- Ay adı dinamik: "Nisan Odak Şampiyonu", "Mart Sadık Savaşçı"
- `prestige_history` JSONB'de saklanır: `[{month: "2026-04", level: 35, rewards: [...]}]`
- Prestige sayısı profilde gösterilir: "Prestige III"

### 4.4 Daily Quests (Günlük Görevler)

**Mekanizma:**
- Her gün 00:00'da havuzdan rastgele 3 görev seçilir
- Aynı gün içinde aynı tip tekrar seçilmez
- Zorluk: Kullanıcının son 7 günlük ortalamasına göre dinamik
- Gece yarısı tamamlanmayanlar kaybolur

**Quest Havuzu (~25 tip):**

| Quest Tipi | Parametre | Örnek |
|------------|-----------|-------|
| complete_pomodoros | count: 2-6 | "4 pomodoro tamamla" |
| complete_tasks | count: 1-5 | "3 görev tamamla" |
| complete_subtasks | count: 2-8 | "5 subtask tamamla" |
| focus_time | minutes: 30-120 | "60 dakika focus" |
| complete_urgent_task | count: 1-2 | "1 urgent görev tamamla" |
| complete_high_priority | count: 1-3 | "2 yüksek öncelik görev" |
| uninterrupted_focus | minutes: 25-60 | "45dk kesintisiz focus" |
| complete_in_category | category + count | "Work kategorisinde 2 görev" |
| create_tasks | count: 2-5 | "3 yeni görev oluştur" |
| complete_before_noon | count: 1-3 | "Öğleden önce 2 pomodoro" |
| no_skip_break | count: 3-5 | "3 break'i atlamadan tamamla" |
| start_early | hour: 7-9 | "Saat 9'dan önce başla" |
| evening_session | count: 1-2 | "Akşam 1 pomodoro yap" |
| clear_overdue | count: 1-3 | "2 gecikmiş görevi tamamla" |
| long_focus | minutes: 45-60 | "45dk'lık focus session" |

**XP Ödülleri:**
- Her quest: 20 XP
- 3/3 tamamlama bonusu: 30 XP (toplam 90 XP)

### 4.5 Weekly Goals (Haftalık Hedefler)

**Sistem Hedefleri (her pazartesi 00:00):**
- Havuzdan 2-3 haftalık hedef atanır
- Örnekler: "Bu hafta 15 pomodoro", "5 gün streak koru", "8 görev tamamla"
- Zorluk kullanıcının son 4 hafta ortalamasına göre

**Kişisel Hedef:**
- Kullanıcı kendisi koyar (metrik seçimi + sayısal hedef)
- Metrikler: pomodoro, görev, focus süresi, subtask
- Hafta sonunda değerlendirilir

**XP Ödülleri:**
- Her sistem hedefi: 100 XP
- Kişisel hedef: 150 XP
- Tümü tamamlanınca bonus: 100 XP

### 4.6 Combo Sistemi

**Session Combo:**
- Üst üste pomodoro tamamladıkça çarpan artar
- Çarpan kademesi: 1x → 1.5x (2. pomodoro) → 2x (3.) → 2.5x (4.) → 3x (5+)
- Timer "stop" edilirse combo sıfırlanır
- "Pause" combo'yu bozmaz
- Break skip etmek combo'yu bozmaz
- Çarpan sadece pomodoro base XP'ye uygulanır (15 XP base)

**Daily Combo:**
- Ardışık günlerde hem pomodoro hem görev tamamlayınca aktif
- Koşul: O gün en az 1 pomodoro + 1 görev tamamlamış olmak
- Çarpan: 3 gün = 1.5x, 7 gün = 2x, 14 gün = 2.5x, 30 gün = 3x
- Bir gün koşul sağlanmazsa sıfırlanır
- Çarpan tüm base XP'ye uygulanır (pomodoro + görev + subtask)

**Çarpan Kuralları:**
- Session combo ve daily combo stacklenir (çarpılır): 2x session × 2x daily = 4x
- Achievement XP'ye combo uygulanmaz
- Daily quest ve weekly goal XP'ye combo uygulanmaz

### 4.7 Gamification State Yapısı

Combo ve prestige state'i `gamification-store`'da tutulur, `profiles.gamification_state` JSONB'ye sync edilir:

```typescript
interface GamificationState {
  // Mevcut (güncellenen)
  stats: UserStats;
  unlockedAchievements: UserAchievement[];
  dailyStats: DailyStats[];
  pendingNotifications: Achievement[];

  // Yeni
  combo: {
    sessionCombo: number;          // Mevcut session combo sayacı (0, 1, 2, ...)
    dailyComboStreak: number;      // Ardışık daily combo günü
    lastDailyComboDate: string | null; // Son daily combo koşulunu sağlayan gün
  };
  prestige: {
    count: number;                 // Toplam prestige sayısı
    currentSeasonStart: string;    // Mevcut sezon başlangıcı (ay başı)
    history: PrestigeRecord[];     // Geçmiş sezon kayıtları
  };
}

interface PrestigeRecord {
  month: string;       // "2026-04"
  finalLevel: number;  // O ay ulaşılan son seviye
  totalXp: number;     // O ay kazanılan toplam XP
  rewards: string[];   // Kazanılan ay sonu ödül ID'leri
}
```

**Ay sonu ödül XP'si:** Prestige reset'ten ÖNCE verilir (o ayın son seviyesine katkı yapar, ödül kaydedilir, sonra reset uygulanır).

---

## 5. Kod Kalitesi & Bug Fix

### 5.1 Bug Fix'ler

| # | Bug | Dosya | Çözüm |
|---|-----|-------|-------|
| B1 | Pomodoro bildirim zamanlama | pomodoro-store, background-task, pomodoro-task | Single source of truth (Bölüm 2) |
| B2 | `isLoading` dead code | todo-store.ts | Kaldır |
| B3 | `completeSession()` duplikasyonu | pomodoro-store.ts | `_handleCompletion()` kullan |
| B4 | Notification ID ayrı persist | pomodoro-task.ts | Timer state içine taşı |
| B5 | Background AsyncStorage hata | background-task.ts | try/catch + fallback |
| B6 | Recursive XP döngüsü | gamification-store.ts | XP accumulator pattern, tek set |
| B7 | Task-due notification leak | notification-service.ts | Todo silinince notification temizle |
| B8 | Filter persist edilmiyor | todo-store.ts | Filter'ı da persist et |

### 5.2 Kod Tekrarı Temizliği

| Duplicate | Mevcut Yerler | Hedef |
|-----------|---------------|-------|
| `getPhaseDuration`, `getNextPhase` | pomodoro-store, background-task, pomodoro-helpers | `utils/pomodoro-helpers.ts` (tek yer, React bağımsız) |
| `getPriorityColor` | index.tsx, todos.tsx, [id].tsx, kanban.tsx, timeline.tsx | `utils/theme-helpers.ts` |
| `formatTime` (MM:SS) | index.tsx, pomodoro.tsx | `utils/date.ts` |
| `getCategoryColor/Name` | todos.tsx, calendar.tsx, kanban.tsx, timeline.tsx | `utils/category-helpers.ts` veya store selector |

### 5.3 Bileşen Parçalama

**`app/(tabs)/index.tsx` (Dashboard) →**
- `components/dashboard/xp-progress-card.tsx`
- `components/dashboard/quick-stats-grid.tsx`
- `components/dashboard/timer-status-card.tsx`
- `components/dashboard/active-tasks-list.tsx`
- `components/dashboard/quick-actions.tsx`
- `components/dashboard/daily-summary-modal.tsx`
- `components/dashboard/index.ts`

**`app/todo/[id].tsx` (Todo Detay) →**
- `components/todo/todo-detail-view.tsx`
- `components/todo/todo-edit-form.tsx`
- `components/todo/subtask-list.tsx`
- `components/todo/index.ts`

**`app/(tabs)/settings.tsx` →**
- `components/settings/pomodoro-settings.tsx`
- `components/settings/notification-settings.tsx`
- `components/settings/appearance-settings.tsx`
- `components/settings/category-manager.tsx`
- `components/settings/language-settings.tsx`
- `components/settings/index.ts`

### 5.4 Hata Yönetimi

**Input Validation:**
- Todo oluşturma: title zorunlu (min 1 karakter), priority valid enum, status valid enum
- Kategori: name zorunlu, color valid hex
- Pomodoro ayarları: duration > 0, sessionsUntilLongBreak >= 1
- Validation fonksiyonları: `utils/validators.ts`

**AsyncStorage Error Handling:**
- Tüm read/write'lar try/catch içinde
- Read hatası → fallback default değer + console.warn
- Write hatası → retry 1 kez, hâlâ hata → sync queue'ya ekle

**Supabase Error Handling:**
- Network hataları: exponential backoff retry (1s, 2s, 4s, max 3)
- Auth hataları (401/403): token refresh, başarısızsa login ekranına yönlendir
- Validation hataları (400): Kullanıcıya göster
- Server hataları (500): Retry + kullanıcıya "Bağlantı sorunu" mesajı

**Error Boundary İyileştirmesi:**
- Hata mesajlarını daha bilgilendirici yap
- Retry limitini 3'e çıkar
- Hata loglaması (console + ileride Supabase'e)

---

## 6. Test Altyapısı

### 6.1 Kurulum

- Jest + `@testing-library/react-native`
- `jest-expo` preset
- `@testing-library/jest-native` matchers
- Mock'lar: AsyncStorage, expo-notifications, expo-haptics, supabase-js

### 6.2 Unit Testler (hedef: %80+ coverage)

**Store testleri:**
- `todo-store.test.ts` — CRUD, filtreleme, subtask, sıralama, gamification entegrasyonu
- `pomodoro-store.test.ts` — Timer lifecycle, phase transitions, sync, completion, combo
- `gamification-store.test.ts` — XP hesaplama, level up, achievement unlock, streak, combo, prestige
- `category-store.test.ts` — CRUD, default categories, orphan cleanup
- `settings-store.test.ts` — Ayar güncelleme, validation, reset
- `sync-store.test.ts` — Queue yönetimi, retry, conflict resolution

**Util testleri:**
- `date.test.ts` — formatDate, getDateKey
- `pomodoro-helpers.test.ts` — getPhaseDuration, getNextPhase
- `validators.test.ts` — Input validation fonksiyonları
- `theme-helpers.test.ts` — getPriorityColor, vb.

**Gamification testleri:**
- `gamification.test.ts` — calculateLevel, XP formülleri, quest generation
- `combo.test.ts` — Session combo, daily combo, stacking

### 6.3 Integration Testler

- Todo tamamlama → gamification XP akışı
- Pomodoro tamamlama → XP + daily quest ilerleme + combo
- Daily quest generation → completion → XP ödülü
- Weekly goal tracking → completion
- Prestige reset → state korunma/sıfırlanma
- Sync queue → Supabase push/pull → lokal state güncelleme

### 6.4 UI Testler

- Onboarding akışı (welcome → pomodoro setup → category → auth)
- Todo oluşturma formu
- Pomodoro timer kontrolleri (start/pause/stop/skip)
- Ayarlar ekranı değişiklikleri
- Daily summary modal gösterimi
- Achievement unlock modal
- Gün sonu özet modal

---

## 7. i18n (Internationalization)

### 7.1 Kurulum

- `i18next` + `react-i18next` + `expo-localization`
- Dil dosyaları: `locales/tr.json`, `locales/en.json`
- Varsayılan dil: Cihaz diline göre (Türkçe cihazda TR, diğer EN)
- Ayarlardan manuel dil seçimi
- Dil tercihi `profiles.locale`'de saklanır

### 7.2 Çeviri Kapsamı

- Tüm UI metinleri (ekran başlıkları, butonlar, label'lar, placeholder'lar)
- Bildirim mesajları (timer complete, daily summary, achievement unlock)
- Başarım isimleri ve açıklamaları
- Daily quest açıklamaları
- Weekly goal açıklamaları
- Seviye isimleri
- Motivasyon mesajları
- Hata mesajları
- Onboarding metinleri

### 7.3 Yapı

```
locales/
  tr.json    — Türkçe
  en.json    — İngilizce
```

Namespace'ler: `common`, `auth`, `onboarding`, `dashboard`, `todos`, `pomodoro`, `stats`, `settings`, `gamification`, `notifications`, `errors`

---

## 8. Yeni Ekranlar ve UI Değişiklikleri

### 8.1 Yeni Ekranlar

- **Auth ekranları:** Login, Register (isim + email + password)
- **Daily Summary Modal:** Gün sonu özet (Bölüm 3)
- **Daily Quests bölümü:** Dashboard'da veya stats'ta gösterilir
- **Weekly Goals bölümü:** Dashboard'da veya stats'ta gösterilir
- **Combo göstergesi:** Dashboard header'da veya timer ekranında

### 8.2 Güncellenecek Ekranlar

- **Dashboard:** Daily quests kartı, weekly goal progress, combo göstergesi, kişisel karşılama ("Hoşgeldin Fatma")
- **Stats:** Yeni başarımlar grid'i (kategorizeli), prestige bilgisi, combo istatistikleri
- **Settings:** Dil seçimi, hesap yönetimi (profil düzenleme, çıkış)
- **Onboarding:** Auth adımı eklenir (başa)

### 8.3 Navigasyon Akışı (Güncel)

```
app/index.tsx (Root Router)
  ├── Auth yoksa → Auth ekranları (Login/Register)
  ├── Auth var, onboarding yapılmadıysa → Onboarding
  │   ├── welcome.tsx
  │   ├── pomodoro-setup.tsx
  │   └── category-selection.tsx
  └── Her şey tamam → Tabs
      ├── Dashboard (+ daily quests, weekly goals, combo, karşılama)
      ├── Todos
      ├── Pomodoro (+ combo indicator)
      ├── Stats (+ prestige, genişletilmiş başarımlar)
      └── Settings (+ dil, hesap)
```

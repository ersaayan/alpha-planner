# Alpha Planner

[![CI](https://github.com/ersaayan/alpha-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/ersaayan/alpha-planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) · **Türkçe**

Alpha Planner; Pomodoro zamanlayıcısı, görev yöneticisi ve işlerini bitirdikçe seni ödüllendiren bir oyunlaştırma katmanını bir araya getiren, iOS ve Android için ücretsiz ve açık kaynaklı bir verimlilik uygulamasıdır. React Native ve Expo ile geliştirilmiştir.

**Önce yerel (local-first)** çalışır: hesap oluşturman gerekmez, sunucu kullanılmaz. Görevlerin, zamanlayıcı geçmişin ve ilerlemen cihazında kalır.

## Ekran görüntüleri

<!-- TODO(owner): ekran görüntülerini ekle, ör. docs/screenshots/{dashboard,pomodoro,tasks,stats}.png -->

_Ekran görüntüleri yakında eklenecek._

## Özellikler

- **Pomodoro zamanlayıcı:** odaklanma, kısa mola ve uzun mola süreleri özelleştirilebilir. Her aşamanın sonu yerel bir bildirimle haber verilir; böylece ekran kapalıyken ya da uygulama arka plandayken de zamanlayıcı çalışmaya devam eder.
- **Görev yönetimi:** alt görevler, öncelikler ve kategoriler.
- **Görevlere dört farklı bakış:** liste, kanban panosu, takvim ve zaman çizelgesi.
- **Oyunlaştırma:** XP kazan, seviye atla, başarımların kilidini aç, günlük seriler tut, günlük görevleri tamamla ve haftalık hedeflere ulaş.
- **Karanlık mod** (açık, koyu ya da sistemi takip et).
- **Türkçe ve İngilizce:** cihaz dilini takip eder ya da Ayarlar'dan seçebilirsin.

## Yerel çalışma ve gizlilik

Alpha Planner hesap gerektirmez; analitik, reklam ya da takip içermez. Tüm veriler cihazda saklanır ve uygulamayı sildiğinde ya da Ayarlar'daki **Tüm Verileri Sıfırla** seçeneğini kullandığında silinir. Bildirimler yerel olarak zamanlanır. Ayrıntılar için [gizlilik politikasına](PRIVACY.md) bak.

Kendi arka ucunu çalıştırmak isteyenler için isteğe bağlı ve deneysel bir bulut senkronizasyonu vardır; varsayılan olarak kapalıdır ([Deneysel senkronizasyon](#deneysel-senkronizasyon-isteğe-bağlı)).

## Teknoloji yığını

- [Expo](https://expo.dev) SDK 58 ve React Native; gezinme için [Expo Router](https://docs.expo.dev/router/introduction/)
- TypeScript
- Durum yönetimi için [Zustand](https://zustand.docs.pmnd.rs/) (AsyncStorage'a kalıcı olarak yazılır)
- Çeviriler için [i18next](https://www.i18next.com/) / react-i18next
- Arayüz bileşenleri için [UI Kitten](https://akveo.github.io/react-native-ui-kitten/) (Eva Design System)
- Zamanlayıcı bildirimleri için [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- Testler için Jest ve React Native Testing Library
- Senkronizasyon için [Supabase](https://supabase.com) (isteğe bağlı, deneysel)

## Başlarken

### Gereksinimler

- **Node.js 22 LTS** ve npm
- **Xcode 26 veya üzeri** (yalnızca macOS; iOS derlemeleri ve iOS Simülatörü için)
- **Android Studio**; bir Android SDK'sı ve bir emülatör ya da cihaz (Android derlemeleri için)

### Development build gereklidir

Alpha Planner **Expo Go'da çalışmaz.** Özel bildirim sesleri ve Expo Go'nun desteklemediği yerel (native) yapılandırmalar kullanır. Bu yüzden bir kez development client (`expo-dev-client`) derlersin, sonrasında Metro ile her zamanki gibi geliştirmeye devam edersin.

### Kurulum ve çalıştırma

```bash
git clone https://github.com/ersaayan/alpha-planner.git
cd alpha-planner
npm ci

npx expo run:ios       # development build'i derler ve iOS simülatöründe ya da cihazında açar
npx expo run:android   # development build'i derler ve Android emülatöründe ya da cihazında açar
```

İlk yerel derlemeden sonra yalnızca geliştirme sunucusunu başlatman yeterli:

```bash
npm start
```

### Komutlar

| Komut | Ne yapar |
|-------|----------|
| `npm ci` | Bağımlılıkları lockfile'a göre kurar |
| `npm start` | Development build için Metro geliştirme sunucusunu başlatır |
| `npx expo run:ios` | iOS development build'i derler ve çalıştırır |
| `npx expo run:android` | Android development build'i derler ve çalıştırır |
| `npm test` | Jest test paketini çalıştırır |
| `npm run typecheck` | TypeScript ile tip denetimi yapar |
| `npm run lint` | ESLint ile kodu denetler |

## Deneysel senkronizasyon (isteğe bağlı)

Uygulama, kendi barındırdığın bir [Supabase](https://supabase.com) arka ucuyla veri senkronize edebilir. Bu özellik **deneyseldir** ve **varsayılan olarak kapalıdır.** Yalnızca derleme zamanında şu iki değişkenin **ikisi birden** tanımlıysa açılır:

```bash
cp .env.example .env
# ardından şunları doldur:
# EXPO_PUBLIC_SUPABASE_URL=...
# EXPO_PUBLIC_SUPABASE_KEY=...   # yalnızca anon / publishable anahtar; asla service_role anahtarı değil
```

Senkronizasyon açıkken de giriş yapmak isteğe bağlıdır: uygulama hesapsız çalışır, **Ayarlar → Senkronizasyon** bölümü "Senkronizasyon için giriş yap" (ve hesap silme) seçeneğini sunar. Veritabanı şeması [`supabase/migrations`](supabase/migrations) klasöründedir; kurulum adımları için [`supabase/README.md`](supabase/README.md) dosyasına bak. Senkronizasyonu açık bir derleme dağıtırsan kendi gizlilik politikan senin sorumluluğundadır.

## Proje yapısı

```
app/            Ekranlar ve gezinme (Expo Router)
components/     Yeniden kullanılabilir arayüz bileşenleri
constants/      Tema, animasyon ve oyunlaştırma yapılandırması
hooks/          Özel React hook'ları
locales/        Çeviriler (en.json, tr.json)
services/       Bildirimler, arka plan görevleri, i18n, isteğe bağlı senkronizasyon
stores/         Zustand store'ları (AsyncStorage'a kalıcı olarak yazılır)
types/          TypeScript tip tanımları
utils/          Yardımcı fonksiyonlar
assets/         Görseller, ikonlar ve sesler
supabase/       İsteğe bağlı senkronizasyon şeması ve kurulum rehberi
__tests__/      Birim, entegrasyon ve ekran testleri
docs/           Mimari notları
```

Parçaların birbirine nasıl bağlandığını (store'lar, zamanlayıcı modeli, oyunlaştırma, i18n ve senkronizasyon) [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) dosyasında bulabilirsin.

## Fork'lama ve kendi sürümünü yayınlama

Kendi sürümünü derleyip yayınlamak istiyorsan, orijinal uygulamayla çakışmaması için en azından şunları değiştir:

- `app.json` içindeki `expo.ios.bundleIdentifier` ve `expo.android.package` (şu an `com.ersaayan.alphaplanner`)
- `app.json` içindeki `expo.owner` (kendi Expo hesabın ya da organizasyonun; EAS kullanmadan derleyeceksen sil)
- `app.json` içindeki `expo.extra.eas.projectId` (kendi EAS projeni oluşturmak için `eas init` çalıştır)
- `assets/images/` içindeki uygulama ikonu, adaptive ikon, bildirim ikonu ve açılış (splash) görseli; nelerin yeniden kullanılabileceği için [ASSETS.md](ASSETS.md) dosyasına bak
- senkronizasyonu açacaksan kendi `.env` dosyandaki (ve EAS ortamındaki) ortam değişkenleri

## Katkıda bulunma

Katkılara açığız. Lütfen önce [CONTRIBUTING.md](CONTRIBUTING.md) ve [Davranış Kuralları](CODE_OF_CONDUCT.md) dosyalarını oku. Güvenlik sorunlarını bildirmek için [SECURITY.md](SECURITY.md) dosyasına bak.

## Lisans

Alpha Planner [MIT Lisansı](LICENSE) ile yayınlanmıştır. Üçüncü taraf varlıklar [ASSETS.md](ASSETS.md) dosyasında listelenmiştir.

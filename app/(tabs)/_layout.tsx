import { CustomTabBar } from '@/components/navigation';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabLayout() {
  const { t } = useTranslation();

  // Icons and the floating bar come from CustomTabBar; the titles name each tab for
  // screen readers (and the browser tab on web).
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="todos" options={{ title: t('tabs.tasks') }} />
      <Tabs.Screen name="pomodoro" options={{ title: t('tabs.timer') }} />
      <Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
    </Tabs>
  );
}

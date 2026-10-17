import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { AboutSection } from '@/components/settings/about-section';
import { LINKS } from '@/constants/links';

jest.mock('@ui-kitten/components', () => {
  const { Text, View } = require('react-native');
  return {
    Text: (props: any) => <Text {...props}>{props.children}</Text>,
    Card: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Divider: () => <View />,
  };
});
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/utils/app-version', () => ({ getAppVersion: () => ({ version: '1.0.0', build: '7' }) }));

describe('Settings → About', () => {
  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('links to the privacy policy, source, license and bug form', async () => {
    await render(<AboutSection />);
    const expected: Record<string, string> = {
      'about-privacy': LINKS.privacyPolicy,
      'about-source': LINKS.sourceCode,
      'about-license': LINKS.license,
      'about-bug': LINKS.reportBug,
    };
    for (const [testID, url] of Object.entries(expected)) {
      await fireEvent.press(screen.getByTestId(testID));
      expect(Linking.openURL).toHaveBeenLastCalledWith(url);
    }
    expect(LINKS.privacyPolicy).toBe('https://github.com/ersaayan/alpha-planner/blob/master/PRIVACY.md');
  });

  it('shows the version and build number and names the links for screen readers', async () => {
    await render(<AboutSection />);
    expect(screen.getByTestId('about-version').props.children).toBe('1.0.0 (build 7)');
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link', { name: /Privacy policy/ })).toBeTruthy();
  });
});

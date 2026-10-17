/** Public pages the app links to (Settings → About). Stores require the privacy policy in-app. */
const REPO = 'https://github.com/ersaayan/alpha-planner';

export const LINKS = {
  privacyPolicy: `${REPO}/blob/master/PRIVACY.md`,
  sourceCode: REPO,
  license: `${REPO}/blob/master/LICENSE`,
  /** Opens the bug report form (.github/ISSUE_TEMPLATE/bug_report.yml). */
  reportBug: `${REPO}/issues/new?template=bug_report.yml`,
} as const;

// Shared app-wide constants. APK_DOWNLOAD_URL was previously hardcoded
// verbatim in settings/page.tsx, onboarding/page.tsx, and app/page.tsx —
// a release-artifact URL change (repo rename, moving off GitHub Releases,
// versioned filenames) would otherwise need updating in three places.
export const APK_DOWNLOAD_URL =
  'https://github.com/axmedovshahzodbek21-crypto/lexivo-web/releases/latest/download/app-release.apk';

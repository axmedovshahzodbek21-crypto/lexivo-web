export const metadata = {
  title: 'Privacy Policy – Lexivo',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-10 text-[var(--text)]">
      <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">Last updated: September 2026</p>

      <div className="space-y-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--text)] [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-[var(--text-muted)] [&_li]:text-[var(--text-muted)]">
        <p className="text-[var(--text-muted)]">
          Lexivo (&quot;we&quot;, &quot;us&quot;) provides an English vocabulary learning app and
          website for Uzbek speakers. This policy explains what information we collect,
          why, and how you can control it.
        </p>

        <div>
          <h2>Information we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information: your name, email address, and profile photo, when you sign up or sign in with email/password or Google Sign-In.</li>
            <li>Content you provide: words and lists you add or import, quiz and flashcard results, study streaks, XP, and other learning progress.</li>
            <li>Class data: if you join or teach a class, your membership, homework progress, and messages within that class are visible to other members of that class as needed for the feature to work.</li>
            <li>Profile pictures you choose to upload are stored in our file storage.</li>
            <li>Push notification tokens, if you enable notifications, so we can send you study reminders and class/homework alerts.</li>
            <li>Basic technical information (such as device type and app version) needed to keep the app working and to diagnose bugs.</li>
          </ul>
        </div>

        <div>
          <h2>How we use your information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To run your account, sync your progress across devices, and power the spaced-repetition, quiz, and class features.</li>
            <li>To send optional reminders and notifications you&apos;ve enabled.</li>
            <li>To generate audio pronunciation and, where you use AI-assisted import or reading features, to process the text you submit and return a result.</li>
            <li>We do not sell your personal information, and we do not use it for third-party advertising.</li>
          </ul>
        </div>

        <div>
          <h2>Third-party services we use</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong> — hosts our database, authentication, and file storage.</li>
            <li><strong>Google Sign-In</strong> — an optional way to sign in without a separate password.</li>
            <li><strong>OneSignal</strong> — delivers push notifications, if enabled.</li>
            <li><strong>Anthropic and OpenAI</strong> — process text you submit for AI-assisted features (such as importing a custom word list or generating study content).</li>
            <li><strong>Google Cloud Text-to-Speech</strong> — generates spoken audio for vocabulary words and examples.</li>
            <li><strong>Telegram</strong> — powers our optional support chat, if you choose to contact us there.</li>
          </ul>
          <p className="mt-2">
            Each of these providers processes data only as needed to provide their part of
            the service, under their own privacy terms.
          </p>
        </div>

        <div>
          <h2>Data security</h2>
          <p>
            Your data is protected with row-level security policies on our database, so
            each account can only access its own data (and, where relevant, the shared
            data of a class it belongs to). We do not store payment card details.
          </p>
        </div>

        <div>
          <h2>Your choices</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You can edit or delete your profile information from within the app&apos;s settings.</li>
            <li>You can disable push notifications at any time from your device or app settings.</li>
            <li>To request full deletion of your account and associated data, contact us using the details below.</li>
          </ul>
        </div>

        <div>
          <h2>Children&apos;s privacy</h2>
          <p>
            Lexivo is not directed at children under 13, and we do not knowingly collect
            personal information from children under that age.
          </p>
        </div>

        <div>
          <h2>Changes to this policy</h2>
          <p>
            We may update this policy as the app changes. We&apos;ll update the date at the
            top of this page when we do.
          </p>
        </div>

        <div>
          <h2>Contact us</h2>
          <p>
            Questions about this policy or your data? Email{' '}
            <a href="mailto:websitepaid21@gmail.com" className="text-[var(--primary)] underline">
              websitepaid21@gmail.com
            </a>{' '}
            or message us on{' '}
            <a href="https://t.me/lexivo_support_bot" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline">
              Telegram
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}

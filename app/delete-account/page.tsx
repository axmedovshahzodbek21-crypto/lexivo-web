export const metadata = {
  title: 'Delete your account – Lexivo',
};

// Public page Google Play links to as the "delete account" URL. It must work
// without the app installed, so it explains both the in-app and email routes.
export default function DeleteAccountPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-10 text-[var(--text)]">
      <h1 className="text-2xl font-bold mb-1">Hisobni o&apos;chirish · Delete your account</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">Lexivo</p>

      <div className="space-y-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--text)] [&_h2]:mb-2 [&_p]:text-[var(--text-muted)] [&_li]:text-[var(--text-muted)]">
        <div>
          <h2>Ilovada yoki saytda</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Lexivo ilovasini yoki saytini oching va hisobingizga kiring.</li>
            <li>Sozlamalar bo&apos;limiga o&apos;ting.</li>
            <li>&quot;Hisobni o&apos;chirish&quot; tugmasini bosing va tasdiqlang.</li>
          </ol>
          <p className="mt-2">Hisobingiz va barcha ma&apos;lumotlaringiz darhol butunlay o&apos;chiriladi.</p>
        </div>

        <div>
          <h2>In the app or on the website</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open the Lexivo app or website and sign in.</li>
            <li>Go to Settings (Sozlamalar).</li>
            <li>Tap &quot;Delete account&quot; (Hisobni o&apos;chirish) and confirm.</li>
          </ol>
          <p className="mt-2">Your account and all its data are deleted immediately and permanently.</p>
        </div>

        <div>
          <h2>Without the app · Ilovasiz</h2>
          <p>
            Email{' '}
            <a href="mailto:websitepaid21@gmail.com?subject=Delete%20my%20Lexivo%20account" className="text-[var(--primary)] underline">
              websitepaid21@gmail.com
            </a>{' '}
            from the address you signed up with, and we will delete your account within 7 days.
            Hisobingiz ochilgan email manzildan yozing — 7 kun ichida o&apos;chiramiz.
          </p>
        </div>

        <div>
          <h2>What is deleted · Nima o&apos;chiriladi</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your account, name, email and profile photo</li>
            <li>Learned words, word lists, review (SRS) progress, XP, streaks and stats</li>
            <li>Classes you created, with their word lists and homework</li>
            <li>Your class memberships, homework progress and class messages</li>
            <li>Notification records</li>
          </ul>
          <p className="mt-2">
            We do not keep any of this data after deletion. O&apos;chirilgandan keyin hech qanday
            ma&apos;lumot saqlanmaydi.
          </p>
        </div>
      </div>
    </div>
  );
}

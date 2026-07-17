import { LegalShell } from '../components/LegalShell';

export function CookiesPage() {
  return (
    <LegalShell title="Cookie preferences" updated="Last updated: 5 July 2026">
      <p>
        This page explains what Beamcard stores in your browser and how to control it. In short:
        Beamcard uses <strong>no analytics or advertising cookies</strong>, so there are currently no optional
        cookies to switch on or off.
      </p>

      <h2>Essential storage (always on)</h2>
      <ul>
        <li><strong>Sign-in session</strong> — kept in local storage so you stay logged in.</li>
        <li><strong>Language preference</strong> — remembers the interface language you chose.</li>
      </ul>
      <p>These are required for the service to work and are never used to track you.</p>

      <h2>Third-party cookies (only when used)</h2>
      <ul>
        <li>
          <strong>Sign in with Google</strong> — if you use it, Google may set cookies as part of its sign-in flow.
        </li>
        <li>
          <strong>Embedded maps</strong> — a card that lists a workplace address may show a Google Map, which can set
          Google cookies. These load only on cards that use a map.
        </li>
      </ul>
      <p>Those cookies are controlled by Google under its own policies.</p>

      <h2>Managing cookies</h2>
      <p>
        You can clear or block cookies and site data through your browser settings (clearing Beamcard's data will sign
        you out). If we add optional cookies in the future (e.g. analytics), a preferences control will appear here so
        you can opt in or out. [Wire this to a consent manager when analytics is introduced.]
      </p>
    </LegalShell>
  );
}

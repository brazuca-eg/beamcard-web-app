import { LegalShell } from '../components/LegalShell';

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="Last updated: 5 July 2026">
      <p>
        This Privacy Policy explains how <strong>[Operator name]</strong> ("Beamcard", "we") collects and uses
        personal data when you use Beamcard at <strong>[your domain]</strong>. For any privacy question or request,
        contact <a href="mailto:[contact@example.com]">[contact@example.com]</a>.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your email address and either a hashed password or, if you sign in with Google,
          your Google account identifier. We never store your Google password.
        </li>
        <li>
          <strong>Profile / card content you provide:</strong> handle, display name, bio, phone number, location,
          workplaces, links, and images you upload (avatar, certificates, showcase photos).
        </li>
        <li>
          <strong>Technical:</strong> limited server logs (e.g. request metadata) for security and reliability. We
          store your session token in your browser's local storage to keep you signed in — not for tracking.
        </li>
      </ul>

      <h2>Cookies and local storage</h2>
      <p>
        Beamcard itself does not use tracking or advertising cookies. To run the service we store a small amount of
        data in your browser:
      </p>
      <ul>
        <li>
          <strong>Local storage (essential):</strong> your sign-in session and your language preference — needed to
          keep you logged in and show the interface in your language. This is not used to track you.
        </li>
        <li>
          <strong>Third-party cookies (only when used):</strong> if you choose "Sign in with Google", or when a card
          shows an embedded Google Map, Google may set its own cookies. These are governed by Google's privacy policy.
        </li>
      </ul>
      <p>
        You can clear this data via your browser settings; clearing the session data will sign you out. [If you later
        add analytics or other non-essential cookies, add a consent banner here.]
      </p>

      <h2>Your public card is public</h2>
      <p>
        The content of your card is <strong>published at your public URL (/@handle)</strong> and is visible to anyone
        with the link. Do not put anything on your card that you do not want to be public. This is the core purpose of
        the service.
      </p>

      <h2>How and why we use data</h2>
      <ul>
        <li>To provide the service — host and display your public card (performance of our contract with you).</li>
        <li>To authenticate you and secure the service (legitimate interests / security).</li>
        <li>To send transactional email such as password resets (performance of contract).</li>
        <li>Optional profile data is processed on the basis of your choice to add it (consent).</li>
      </ul>

      <h2>Sensitive content</h2>
      <p>
        Some users may upload images that could reveal sensitive information (for example, patient before/after
        photos). You are responsible for having the legal right and any necessary consents to upload and publish such
        content. Do not upload others' personal or health data without a lawful basis.
      </p>

      <h2>Service providers</h2>
      <p>We share data only with processors that help us run the service:</p>
      <ul>
        <li><strong>Hosting</strong> (application + database) and <strong>website hosting</strong> providers.</li>
        <li><strong>File storage</strong> for uploaded images.</li>
        <li><strong>Email delivery</strong> for transactional messages.</li>
        <li><strong>Google</strong> — only if you choose "Sign in with Google" (shares your Google email and basic profile with us).</li>
      </ul>
      <p>Some providers are located outside the EEA; transfers rely on appropriate safeguards (e.g. SCCs). [Confirm your providers and safeguards.]</p>

      <h2>Retention</h2>
      <p>
        We keep your data while your account is active. You can request deletion at any time by contacting us; we will
        delete your account, profile, links, and uploaded files, subject to any legal retention obligations.
      </p>

      <h2>Your rights (GDPR)</h2>
      <p>
        If you are in the EEA/UK, you have the right to access, correct, delete, restrict, or port your data, and to
        object to certain processing. To exercise these, contact <a href="mailto:[contact@example.com]">[contact@example.com]</a>.
        You may also lodge a complaint with your local data protection authority.
      </p>

      <h2>Children</h2>
      <p>Beamcard is not intended for anyone under 16. We do not knowingly collect data from children.</p>

      <h2>Changes</h2>
      <p>We may update this policy; we will post the new version here and update the date above.</p>
    </LegalShell>
  );
}

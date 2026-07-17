import { LegalShell } from '../components/LegalShell';

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="Last updated: 5 July 2026">
      <p>
        These Terms govern your use of Beamcard, operated by <strong>[Operator name]</strong> ("we"). By creating an
        account or using the service you agree to these Terms. If you do not agree, do not use the service.
      </p>

      <h2>The service</h2>
      <p>
        Beamcard lets you create a shareable public profile ("card") with links, contact details, credentials, and
        photos, reachable at a public URL. We offer a free tier and may offer paid plans in the future.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Provide accurate information and keep your login credentials secure.</li>
        <li>You are responsible for activity under your account.</li>
        <li>One person or entity per account; do not impersonate others.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You retain ownership of the content you add. You grant us a worldwide, non-exclusive, royalty-free licence to
        host, store, and publicly display that content <em>solely to operate the service</em> (i.e. to show your public
        card). You represent that you have all rights and consents needed for the content you upload — including images
        of other people — and that it does not infringe anyone's rights.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use Beamcard to:</p>
      <ul>
        <li>post unlawful, infringing, deceptive, or harmful content;</li>
        <li>impersonate a person or organization, or misrepresent affiliation;</li>
        <li>distribute malware or link to malicious content;</li>
        <li>harass others or violate their privacy; or</li>
        <li>attempt to disrupt, overload, or gain unauthorized access to the service.</li>
      </ul>

      <h2>Third-party names and logos</h2>
      <p>
        Platform names and logos shown on cards (e.g. social networks) belong to their owners. Beamcard is not
        affiliated with, endorsed by, or sponsored by them; they are shown only to link to your own profiles.
      </p>

      <h2>Availability and disclaimer</h2>
      <p>
        The service is provided "as is" and "as available", without warranties of any kind. We do our best to keep it
        running but do not guarantee uninterrupted or error-free operation.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages,
        or for loss of data or profits, arising from your use of the service. [Adjust to your jurisdiction; consumer
        protections may not be excludable.]
      </p>

      <h2>Suspension and termination</h2>
      <p>
        You may stop using Beamcard at any time. We may suspend or terminate accounts that violate these Terms or the
        law. On termination we may delete your data as described in the Privacy Policy.
      </p>

      <h2>Changes</h2>
      <p>We may update these Terms; continued use after changes means you accept the updated Terms.</p>

      <h2>Governing law</h2>
      <p>These Terms are governed by the laws of <strong>[Country/State]</strong>, without regard to conflict-of-laws rules.</p>

      <h2>Contact</h2>
      <p>Questions about these Terms: <a href="mailto:[contact@example.com]">[contact@example.com]</a>.</p>
    </LegalShell>
  );
}

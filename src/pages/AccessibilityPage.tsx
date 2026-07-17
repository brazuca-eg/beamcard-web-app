import { LegalShell } from '../components/LegalShell';

export function AccessibilityPage() {
  return (
    <LegalShell title="Accessibility" updated="Last updated: 5 July 2026">
      <p>
        Beamcard aims to be usable by everyone, and we work toward conformance with the
        Web Content Accessibility Guidelines (WCAG) 2.1 level AA.
      </p>

      <h2>What we do</h2>
      <ul>
        <li>Semantic HTML and labelled form fields so screen readers can navigate the app.</li>
        <li>Keyboard access for interactive elements (links, buttons, dialogs, the image viewer).</li>
        <li>Visible focus states and colour choices intended to meet contrast guidelines.</li>
        <li>Responsive layouts that work from small phones to desktop.</li>
        <li>Text alternatives for images (avatars, certificates, showcase photos).</li>
      </ul>

      <h2>Known limitations</h2>
      <p>
        We have not yet completed a full third-party accessibility audit, so some areas may fall short.
        We are continuing to improve. [List any known issues here.]
      </p>

      <h2>Feedback</h2>
      <p>
        If you hit an accessibility barrier, please tell us at <a href="mailto:[contact@example.com]">[contact@example.com]</a>
        {' '}and we will do our best to help and to fix it.
      </p>
    </LegalShell>
  );
}

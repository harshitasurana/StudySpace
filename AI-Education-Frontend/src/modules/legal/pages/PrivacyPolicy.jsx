import React from 'react';
import { Link } from 'react-router-dom';
import LegalPageLayout, { Section, P, Ul, Callout } from '../components/LegalPageLayout';
import { BRAND_NAME } from '../../../constants/brand';

const PrivacyPolicy = () => (
  <LegalPageLayout title="Privacy Policy" lastUpdated="September 8, 2026">
    <P>
      {BRAND_NAME} is operated by MintiQ ("MintiQ", "we", "us", "our"). This policy explains what
      personal data we collect from students and school staff who use the
      {BRAND_NAME} platform, why we collect it, who we share it with, and the choices and rights
      you have over it.
    </P>

    <Callout>
      Many {BRAND_NAME} users are school students under 18. Where a user is a child under the
      Digital Personal Data Protection Act, 2023 ("DPDP Act"), we process their personal data only
      with verifiable consent from a parent or lawful guardian, and we do not use a child's data
      for behavioural monitoring or targeted advertising. See our{' '}
      <Link to="/dpdp-consent" className="text-primary underline">DPDP Act (2023) Consent</Link>{' '}
      notice for the specifics.
    </Callout>

    <Section title="1. Information We Collect">
      <P><strong>Account information:</strong> name, email address, phone number, and password (stored as a salted hash — we never store or can retrieve your actual password).</P>
      <P><strong>Academic profile:</strong> board, class/standard, and subjects you're enrolled in, used to scope the curriculum content and quizzes you're shown.</P>
      <P><strong>Learning activity:</strong> AI Tutor conversations, quiz/mock-test/pre-assessment attempts and scores, notes, bookmarks, study streaks, and achievements — this is the data that powers your progress dashboard and personalized recommendations.</P>
      <P><strong>Security data:</strong> two-factor authentication status (we store whether 2FA is enabled and encrypted backup codes, never in a form that lets anyone but you complete a login), login timestamps, and basic device/browser information used to detect suspicious activity.</P>
    </Section>

    <Section title="2. How We Use Your Information">
      <Ul>
        <li>To provide the core product: chapter-grounded AI tutoring, quiz/mock-test/flashcard generation, mind maps, progress tracking, and study-plan recommendations.</li>
        <li>To send account and activity notifications you've opted into (quiz results, streak milestones, study reminders) and transactional emails (welcome emails, password resets).</li>
        <li>To maintain the security of your account (fraud/abuse detection, rate-limiting, 2FA).</li>
        <li>To improve the product — we may review aggregated, de-identified usage patterns (e.g., which chapters are most requested) to prioritize content and fix bugs. We do not use your individual conversations or scores to train third-party AI models.</li>
      </Ul>
    </Section>

    <Section title="3. How AI Processing Works">
      <P>
        When you chat with the AI Tutor or generate a quiz/mind map, the relevant chapter content
        and your question are sent to a language model to produce a response. Depending on how a
        given deployment is configured, this model may run entirely on our own private
        infrastructure (self-hosted, via Ollama) or, where enabled, on a third-party AI provider
        such as Google Gemini. In either case, only the academic content needed to answer your
        question is sent — not your account credentials, and not more of your personal profile than
        is needed to phrase an age/board/class-appropriate response.
      </P>
    </Section>

    <Section title="4. Who We Share Data With">
      <P>We don't sell your personal data. We share it only with the service providers needed to run the platform, each acting on our instructions:</P>
      <Ul>
        <li><strong>Hostinger</strong> — sends transactional emails (welcome, password reset, notifications) on our behalf.</li>
        <li><strong>Cloud AI providers (where enabled)</strong> — e.g. Google Gemini, to generate tutoring responses and quiz content, as described above.</li>
        <li><strong>Object storage</strong> — chapter PDFs and other course materials are hosted on our own MinIO/S3-compatible storage.</li>
      </Ul>
      <P>We may also disclose information if required by law, or to protect the rights, safety, or property of {BRAND_NAME}, our users, or the public.</P>
    </Section>

    <Section title="5. Data Retention & Deletion">
      <P>
        We retain your account and learning-activity data for as long as your account is active, so
        your progress history remains meaningful. If you ask us to delete your account, we
        deactivate it immediately and permanently erase your personal data within a reasonable
        period, except where we're required to retain limited records for legal or accounting
        purposes.
      </P>
    </Section>

    <Section title="6. Your Rights">
      <P>Subject to applicable law (including the DPDP Act for users in India), you can:</P>
      <Ul>
        <li>Access a copy of the personal data we hold about you.</li>
        <li>Correct inaccurate or incomplete data.</li>
        <li>Withdraw consent and request erasure of your data.</li>
        <li>Lodge a complaint with our Grievance Officer (see Contact below), or with the relevant data protection authority.</li>
      </Ul>
    </Section>

    <Section title="7. Security">
      <P>
        See our <Link to="/security-statement" className="text-primary underline">Security Statement</Link> for
        the technical and organizational measures we use to protect your data.
      </P>
    </Section>

    <Section title="8. Changes to This Policy">
      <P>
        We may update this policy as the product evolves. We'll update the "Last updated" date
        above, and for material changes affecting how we handle children's data, we'll seek fresh
        parental consent where required.
      </P>
    </Section>

    <Section title="9. Contact & Grievance Officer">
      <P>
        For any privacy question, data request, or complaint, contact our Grievance Officer at{' '}
        <a href="mailto:itdesk@myntiqtech.com" className="text-primary underline">itdesk@myntiqtech.com</a>.
      </P>
    </Section>
  </LegalPageLayout>
);

export default PrivacyPolicy;

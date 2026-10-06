import React from 'react';
import LegalPageLayout, { Section, P, Ul } from '../components/LegalPageLayout';
import { BRAND_NAME } from '../../../constants/brand';

const SecurityStatement = () => (
  <LegalPageLayout title="Security Statement" lastUpdated="September 8, 2026">
    <P>
      This page describes, in plain language, the concrete technical and organizational measures
      {' '}{BRAND_NAME} uses to protect your account and data. We've written it to reflect what we
      actually do, not a generic checklist — if something changes materially, we'll update this page.
    </P>

    <Section title="1. Authentication & Account Security">
      <Ul>
        <li>Passwords are never stored in plain text — they're hashed with bcrypt before being saved.</li>
        <li>Sessions use short-lived JWT access tokens plus a rotating, httpOnly refresh token, so a stolen access token has a narrow window of use and the long-lived credential is never exposed to page scripts.</li>
        <li>Optional two-factor authentication (TOTP-based, with one-time backup codes) is available from Settings for an extra layer of protection on your account.</li>
        <li>Login attempts are rate-limited and monitored for abuse.</li>
      </Ul>
    </Section>

    <Section title="2. Data in Transit & at Rest">
      <Ul>
        <li>All traffic between your browser and {BRAND_NAME} is encrypted over HTTPS/TLS.</li>
        <li>Application secrets (database credentials, API keys, storage credentials) are held as environment-level configuration, not committed to source code.</li>
        <li>Uploaded course materials (chapter PDFs, NCERT solutions) are served from our own access-controlled object storage, not a public file share.</li>
      </Ul>
    </Section>

    <Section title="3. Access Control">
      <Ul>
        <li>Administrative access to student data is governed by a role-based permission system — an admin only sees or edits what their assigned role explicitly grants, not the entire dataset by default.</li>
        <li>Internal service-to-service calls (e.g., between our backend and the AI generation service) are authenticated with a shared service key, not left open.</li>
      </Ul>
    </Section>

    <Section title="4. AI Processing">
      <Ul>
        <li>Chapter-grounded AI features (Tutor chat, quizzes, mind maps, flashcards) send only the academic content and question needed to generate a response — not your full profile or credentials.</li>
        <li>Where a deployment routes a request to a third-party AI provider, that request is scoped the same way; it is never used by us to re-identify you across unrelated services.</li>
      </Ul>
    </Section>

    <Section title="5. Infrastructure">
      <P>
        {BRAND_NAME} runs on infrastructure we operate directly (application servers, database, object
        storage, and vector search), rather than a shared consumer-grade host, which lets us control
        network access, backups, and monitoring end to end.
      </P>
    </Section>

    <Section title="6. Reporting a Security Issue">
      <P>
        If you believe you've found a security vulnerability in {BRAND_NAME}, please report it
        responsibly to{' '}
        <a href="mailto:itdesk@myntiqtech.com" className="text-primary underline">itdesk@myntiqtech.com</a>{' '}
        rather than disclosing it publicly. We'll acknowledge your report and work to address
        genuine issues promptly.
      </P>
    </Section>
  </LegalPageLayout>
);

export default SecurityStatement;

import React from 'react';
import { Link } from 'react-router-dom';
import LegalPageLayout, { Section, P, Ul, Callout } from '../components/LegalPageLayout';
import { BRAND_NAME } from '../../../constants/brand';

const DPDPConsent = () => (
  <LegalPageLayout title="DPDP Act (2023) Consent Notice" lastUpdated="September 8, 2026">
    <P>
      This notice is provided under Section 5 of the Digital Personal Data Protection Act, 2023
      ("DPDP Act"). It tells you — as a "Data Principal" — what personal data {BRAND_NAME}
      (operated by MintiQ, the "Data Fiduciary") processes, for what purpose, and how you can
      exercise your rights. Registering an account or completing your academic profile on
      {BRAND_NAME} constitutes your consent to the processing described here, for that specific
      purpose.
    </P>

    <Section title="1. Processing of Children's Personal Data (Section 9)">
      <Callout>
        Under Section 9 of the DPDP Act, a "child" is anyone under 18. Most {BRAND_NAME} students
        fall into this category. For a child user, we process personal data only with{' '}
        <strong>verifiable consent from a parent or lawful guardian</strong>. We do not:
        <Ul>
          <li>Undertake behavioural monitoring or tracking of a child for advertising purposes.</li>
          <li>Show targeted advertisements directed at children.</li>
          <li>Process a child's data in any manner likely to cause detrimental effect on their well-being.</li>
        </Ul>
        A parent/guardian may withdraw consent at any time, which will result in the child's account
        being deactivated and their personal data deleted, consistent with Section 6(4) of the Act.
      </Callout>
    </Section>

    <Section title="2. Personal Data We Process, By Purpose">
      <Ul>
        <li><strong>Identity & contact data</strong> (name, email, phone) — to create and secure your account, and to contact you about it.</li>
        <li><strong>Academic profile</strong> (board, class, subjects) — to scope curriculum content, quizzes, and mind maps to your syllabus.</li>
        <li><strong>Learning activity</strong> (AI Tutor conversations, quiz/mock-test scores, notes, achievements) — to power your personal dashboard, progress tracking, and study recommendations.</li>
      </Ul>
    </Section>

    <Section title="3. How Consent Is Obtained">
      <Ul>
        <li>At registration — for account creation and the base service.</li>
        <li>At role selection (Student or School Student) — for role-specific processing, including sending you the corresponding welcome email.</li>
      </Ul>
    </Section>

    <Section title="4. Withdrawing Consent">
      <P>
        You (or, for a child user, their parent/guardian) may withdraw consent at any time by:
      </P>
      <Ul>
        <li>Requesting full account deletion via our Grievance Officer (contact below) — consequences of withdrawal include loss of access to the service and, where applicable under Section 6(4), we will cease and cause our processors to cease processing your data.</li>
      </Ul>
    </Section>

    <Section title="5. Your Rights as a Data Principal">
      <Ul>
        <li><strong>Right to access</strong> a summary of your personal data and the processing activities.</li>
        <li><strong>Right to correction and erasure</strong> of your personal data.</li>
        <li><strong>Right to grievance redressal</strong> — see below.</li>
        <li><strong>Right to nominate</strong> another individual to exercise these rights on your behalf in the event of death or incapacity (Section 14).</li>
      </Ul>
    </Section>

    <Section title="6. Cross-Border Processing">
      <P>
        Some AI processing may, where a deployment enables it, be performed by a third-party AI
        provider located outside India (e.g., Google Gemini). The DPDP Act permits such transfers
        except to countries specifically restricted by the Central Government; we do not transfer
        personal data to any such restricted jurisdiction.
      </P>
    </Section>

    <Section title="7. Grievance Officer">
      <P>
        Under Section 13 of the DPDP Act, you may raise a grievance regarding our processing of
        your personal data with our Grievance Officer at{' '}
        <a href="mailto:itdesk@myntiqtech.com" className="text-primary underline">itdesk@myntiqtech.com</a>.
        We aim to acknowledge and resolve grievances within a reasonable time. If unresolved, you
        may escalate to the Data Protection Board of India.
      </P>
    </Section>

    <P>
      This notice supplements, and should be read together with, our{' '}
      <Link to="/privacy-policy" className="text-primary underline">Privacy Policy</Link> and{' '}
      <Link to="/terms-of-service" className="text-primary underline">Terms of Service</Link>.
    </P>
  </LegalPageLayout>
);

export default DPDPConsent;

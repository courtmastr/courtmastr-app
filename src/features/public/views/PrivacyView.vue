<script setup lang="ts">
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';

usePublicPageMetadata({
  title: 'Privacy Policy',
  description: 'Privacy policy for CourtMastr by Marvy Technologies.',
  canonicalPath: '/privacy',
});

const lastUpdated = 'March 14, 2026';
const legalEntityName = 'Marvy Technologies';
const legalContactEmail = 'legal@courtmastr.com';
const operatingCountry = 'United States';
const governingLawRegion = 'State of Illinois, United States';
const disputeVenue = 'state or federal courts located in Illinois, United States';
const legalReviewBanner = 'Operational legal draft pending formal legal review before final publication.';
</script>

<template>
  <v-container class="py-10">
    <v-row justify="center">
      <v-col
        cols="12"
        md="10"
        lg="8"
      >
        <v-card class="pa-6 pa-md-8">
          <h1 class="text-h4 mb-2">
            Privacy Policy
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Last updated: {{ lastUpdated }}
          </p>

          <v-alert
            type="warning"
            variant="tonal"
            class="mb-5"
          >
            {{ legalReviewBanner }}
          </v-alert>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              1. Data Controller and Scope
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              CourtMastr is operated by <strong>{{ legalEntityName }}</strong> in the <strong>{{ operatingCountry }}</strong>. This policy applies to account holders,
              tournament organizers, scorekeepers, and public users who interact with CourtMastr web properties.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              2. Information We Collect
            </h2>
            <ul class="text-body-2 text-medium-emphasis pl-5 mb-0">
              <li>Account and profile data (name, email, role, authentication identifiers).</li>
              <li>Tournament operations data (registrations, schedules, scores, courts, audit history).</li>
              <li>Technical and diagnostics data (logs, device/browser metadata, usage telemetry, bug reports).</li>
            </ul>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              3. Legal Bases for Processing
            </h2>
            <ul class="text-body-2 text-medium-emphasis pl-5 mb-0">
              <li>Contractual necessity to provide tournament software services.</li>
              <li>Legitimate interests in reliability, security, fraud prevention, and product improvement.</li>
              <li>Consent for optional communications or non-essential interactions where required.</li>
              <li>Compliance with legal obligations and lawful requests from authorities.</li>
            </ul>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              4. How We Use Information
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              We use collected data to run tournaments, provide live updates, support users, secure accounts, diagnose issues, and improve platform performance.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              5. Sharing and Subprocessors
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              We do not sell personal data. Data may be shared with infrastructure, hosting, authentication, analytics, and support providers strictly
              for service delivery.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              6. Data Retention
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Tournament records are retained for operational continuity, historical reporting, and legal compliance. Retention windows may vary by
              dataset type and customer requirements.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              7. Security
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              CourtMastr applies reasonable administrative, technical, and organizational safeguards, including access controls, audit logging, and
              monitored cloud infrastructure.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              8. User Rights and Requests
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              You may request access, correction, deletion, or export of personal data, subject to operational and legal limits. Submit requests to
              <strong>{{ legalContactEmail }}</strong>.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              9. International Transfers and Jurisdiction
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Data may be processed in the {{ operatingCountry }} and other jurisdictions where service providers operate. Policy interpretation and
              privacy-related disputes are governed by the laws of {{ governingLawRegion }}, with venue in {{ disputeVenue }}.
            </p>
          </section>

          <section>
            <h2 class="text-h6 mb-2">
              10. Contact
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Privacy and legal contact: <strong>{{ legalContactEmail }}</strong> ({{ legalEntityName }})
            </p>
          </section>

          <section class="mt-5">
            <h2 class="text-h6 mb-2">
              11. U.S. State Privacy Rights
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Where applicable, U.S. state privacy laws may provide rights to request access, deletion, correction, and data portability.
              We do not sell personal data. Submit rights requests through <strong>{{ legalContactEmail }}</strong>.
            </p>
          </section>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

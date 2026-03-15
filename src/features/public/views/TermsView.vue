<script setup lang="ts">
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';

usePublicPageMetadata({
  title: 'Terms of Service',
  description: 'Terms of service for CourtMastr by Marvy Technologies.',
  canonicalPath: '/terms',
});

const lastUpdated = 'March 14, 2026';
const legalEntityName = 'Marvy Technologies';
const legalContactEmail = 'legal@courtmastr.com';
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
            Terms of Service
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
              1. Provider and Acceptance
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              These Terms govern your use of CourtMastr, operated by <strong>{{ legalEntityName }}</strong>. By creating an account or using the platform,
              you agree to these Terms.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              2. Service Scope
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              CourtMastr provides tournament operations tooling, including registration management, check-in, scheduling, live scoring,
              public spectator pages, and reporting workflows.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              3. Accounts and Security
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              You are responsible for account credentials, role assignment, and all activity under your account. You must notify us promptly
              of suspected unauthorized use.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              4. Acceptable Use
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              You agree not to misuse the service, attempt unauthorized access, scrape protected data, interfere with platform availability,
              or violate applicable law.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              5. Beta Access and Pricing
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              CourtMastr is currently offered as Free Beta access. Future paid plans, limits, and billing terms may be introduced with advance notice.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              6. Intellectual Property
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              CourtMastr software, branding, and product assets remain the property of {{ legalEntityName }}. You retain rights to your original
              tournament content, subject to licenses required for platform operation.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              7. Disclaimers and Liability Limits
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Service is provided on an "as is" and "as available" basis. To the fullest extent permitted by law, {{ legalEntityName }} disclaims
              implied warranties and limits liability for indirect, incidental, and consequential damages.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              8. Suspension and Termination
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              We may suspend or terminate accounts for material Terms violations, legal risk, abuse, or security concerns. You may discontinue use
              at any time.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="text-h6 mb-2">
              9. Governing Law and Disputes
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              These Terms are governed by the laws of {{ governingLawRegion }}, without regard to conflict-of-law principles. Disputes are resolved
              in {{ disputeVenue }} unless otherwise required by law.
            </p>
          </section>

          <section>
            <h2 class="text-h6 mb-2">
              10. Contact
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Legal contact: <strong>{{ legalContactEmail }}</strong> ({{ legalEntityName }})
            </p>
          </section>

          <section class="mt-5">
            <h2 class="text-h6 mb-2">
              11. Notices and Changes
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              We may revise these Terms as the product evolves. Material updates will be posted on this page with a revised effective date.
              Continued use after changes means you accept the updated Terms.
            </p>
          </section>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

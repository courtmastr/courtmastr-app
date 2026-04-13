<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { HELP_ROLE_FILTERS, getHelpTopicBySlug } from '@/features/help/helpContent';
import type { HelpRole, HelpScreenshot } from '@/features/help/helpTypes';

const route = useRoute();
const authStore = useAuthStore();

const topicSlug = computed(() => String(route.params.topicSlug || ''));
const topic = computed(() => getHelpTopicBySlug(topicSlug.value));
const canViewTechnicalNotes = computed(() => authStore.isAuthenticated && authStore.isAdmin);
const selectedScreenshot = ref<HelpScreenshot | null>(null);
const screenshotDialogOpen = computed({
  get: () => selectedScreenshot.value !== null,
  set: (isOpen: boolean) => {
    if (!isOpen) selectedScreenshot.value = null;
  },
});

const getRoleLabel = (role: HelpRole): string =>
  HELP_ROLE_FILTERS.find((filter) => filter.value === role)?.label ?? role;

const getRelatedTopicTitle = (slug: string): string =>
  getHelpTopicBySlug(slug)?.title ?? slug;

const openScreenshot = (shot: HelpScreenshot): void => {
  if (!shot.src) return;
  selectedScreenshot.value = shot;
};

const closeScreenshot = (): void => {
  selectedScreenshot.value = null;
};
</script>

<template>
  <v-container class="help-topic py-8 py-md-10">
    <template v-if="topic">
      <v-btn
        :to="{ name: 'help-center' }"
        variant="text"
        color="primary"
        prepend-icon="mdi-arrow-left"
        class="mb-4"
      >
        Back to Help Center
      </v-btn>

      <section class="help-topic__header mb-8">
        <div class="help-topic__roles mb-4">
          <v-chip
            v-for="role in topic.audience"
            :key="role"
            color="primary"
            variant="tonal"
          >
            {{ getRoleLabel(role) }}
          </v-chip>
        </div>
        <h1 class="help-topic__title">
          {{ topic.title }}
        </h1>
        <p class="help-topic__summary">
          {{ topic.summary }}
        </p>
      </section>

      <v-row>
        <v-col
          cols="12"
          lg="8"
        >
          <v-card
            rounded="lg"
            variant="outlined"
            class="mb-5"
          >
            <v-card-title>Purpose</v-card-title>
            <v-card-text>{{ topic.purpose }}</v-card-text>
          </v-card>

          <v-card
            rounded="lg"
            variant="outlined"
            class="mb-5"
          >
            <v-card-title>Before you start</v-card-title>
            <v-card-text>
              <ol class="help-topic__list">
                <li
                  v-for="item in topic.beforeYouStart"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ol>
            </v-card-text>
          </v-card>

          <v-card
            rounded="lg"
            variant="outlined"
            class="mb-5"
          >
            <v-card-title>Step-by-step</v-card-title>
            <v-card-text>
              <section
                v-for="(step, index) in topic.steps"
                :key="step.title"
                class="help-topic__step"
              >
                <h2>{{ index + 1 }}. {{ step.title }}</h2>
                <ul class="help-topic__list">
                  <li
                    v-for="detail in step.details"
                    :key="detail"
                  >
                    {{ detail }}
                  </li>
                </ul>
              </section>
            </v-card-text>
          </v-card>

          <v-card
            rounded="lg"
            variant="outlined"
            class="mb-5"
          >
            <v-card-title>Common problems</v-card-title>
            <v-card-text>
              <v-alert
                v-for="problem in topic.commonProblems"
                :key="problem.problem"
                type="info"
                variant="tonal"
                class="mb-3"
              >
                <strong>{{ problem.problem }}</strong>
                <p class="mb-0 mt-1">
                  {{ problem.fix }}
                </p>
              </v-alert>
            </v-card-text>
          </v-card>

          <v-card
            v-if="canViewTechnicalNotes && topic.technicalNotes.length > 0"
            rounded="lg"
            variant="outlined"
          >
            <v-card-title>Technical notes</v-card-title>
            <v-card-text>
              <section
                v-for="note in topic.technicalNotes"
                :key="note.title"
                class="help-topic__technical-note"
              >
                <h2>{{ note.title }}</h2>
                <p>{{ note.body }}</p>
                <h3>Source references</h3>
                <ul class="help-topic__list">
                  <li
                    v-for="source in note.sourceReferences"
                    :key="source"
                  >
                    {{ source }}
                  </li>
                </ul>
              </section>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col
          cols="12"
          lg="4"
        >
          <v-card
            rounded="lg"
            variant="outlined"
            class="mb-5"
          >
            <v-card-title>Screenshots</v-card-title>
            <v-card-text>
              <div
                v-for="shot in topic.screenshots"
                :key="shot.title"
                class="help-topic__screenshot"
              >
                <h2>{{ shot.title }}</h2>
                <button
                  v-if="shot.src"
                  type="button"
                  class="help-topic__screenshot-button"
                  :aria-label="`Open ${shot.title} screenshot`"
                  data-testid="help-screenshot-open"
                  @click="openScreenshot(shot)"
                >
                  <v-img
                    :src="shot.src"
                    :alt="shot.alt"
                    aspect-ratio="1.6"
                    cover
                    rounded="lg"
                  >
                    <div class="help-topic__screenshot-overlay">
                      <v-icon
                        icon="mdi-magnify-plus-outline"
                        size="18"
                      />
                      <span>Open larger</span>
                    </div>
                  </v-img>
                </button>
                <v-alert
                  v-else
                  type="info"
                  variant="tonal"
                  density="compact"
                >
                  {{ shot.notApplicableReason }}
                </v-alert>
              </div>
            </v-card-text>
          </v-card>

          <v-card
            rounded="lg"
            variant="outlined"
          >
            <v-card-title>Related topics</v-card-title>
            <v-card-text>
              <div class="help-topic__related">
                <v-btn
                  v-for="slug in topic.relatedTopics"
                  :key="slug"
                  :to="{ name: 'help-topic', params: { topicSlug: slug } }"
                  variant="tonal"
                  color="primary"
                  block
                >
                  {{ getRelatedTopicTitle(slug) }}
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-dialog
        v-model="screenshotDialogOpen"
        max-width="1180"
      >
        <v-card
          v-if="selectedScreenshot"
          rounded="lg"
          class="help-topic__screenshot-dialog"
        >
          <v-card-title class="d-flex align-center">
            <span>{{ selectedScreenshot.title }}</span>
            <v-spacer />
            <v-btn
              icon="mdi-close"
              variant="text"
              aria-label="Close screenshot"
              @click="closeScreenshot"
            />
          </v-card-title>
          <v-card-text>
            <v-img
              :src="selectedScreenshot.src"
              :alt="selectedScreenshot.alt"
              max-height="78vh"
              contain
              rounded="lg"
            />
          </v-card-text>
        </v-card>
      </v-dialog>
    </template>

    <v-card
      v-else
      rounded="lg"
      variant="outlined"
    >
      <v-card-text class="text-center py-12">
        <v-icon
          icon="mdi-help-circle-outline"
          size="48"
          color="primary"
          class="mb-3"
        />
        <h1 class="help-topic__not-found">
          Help topic not found
        </h1>
        <p>
          This help topic does not exist. Return to the Help Center to search all guides.
        </p>
        <v-btn
          :to="{ name: 'help-center' }"
          color="primary"
        >
          Open Help Center
        </v-btn>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.help-topic {
  max-width: 1180px;
}

.help-topic__header {
  max-width: 860px;
}

.help-topic__roles,
.help-topic__related {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.help-topic__related {
  flex-direction: column;
}

.help-topic__title {
  margin: 0 0 12px;
  font-size: clamp(2rem, 5vw, 3.25rem);
  line-height: 1.08;
  font-weight: 800;
}

.help-topic__summary {
  margin: 0;
  font-size: 1.08rem;
  line-height: 1.65;
  color: rgba(var(--v-theme-on-surface), 0.72);
}

.help-topic__list {
  margin: 0;
  padding-left: 22px;
  line-height: 1.65;
}

.help-topic__step + .help-topic__step,
.help-topic__technical-note + .help-topic__technical-note,
.help-topic__screenshot + .help-topic__screenshot {
  margin-top: 20px;
}

.help-topic__step h2,
.help-topic__technical-note h2,
.help-topic__screenshot h2 {
  margin: 0 0 10px;
  font-size: 1rem;
  line-height: 1.4;
}

.help-topic__technical-note h3 {
  margin: 12px 0 8px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.help-topic__not-found {
  margin: 0 0 8px;
  font-size: 1.5rem;
}

.help-topic__screenshot-button {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  background: transparent;
  cursor: pointer;
}

.help-topic__screenshot-button:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

.help-topic__screenshot-overlay {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.help-topic__screenshot-dialog {
  overflow: hidden;
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useReviewStore } from '@/stores/reviews';

interface ReviewSubmissionDialogProps {
  modelValue: boolean;
  tournamentId?: string;
  tournamentName?: string;
}

const props = withDefaults(defineProps<ReviewSubmissionDialogProps>(), {
  tournamentId: '',
  tournamentName: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submitted: [];
}>();

const authStore = useAuthStore();
const reviewStore = useReviewStore();

const rating = ref(5);
const quote = ref('');
const displayName = ref('');
const organization = ref('');
const errorMessage = ref('');

const dialogOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const ratingOptions = [5, 4, 3, 2, 1];

const resetForm = (): void => {
  rating.value = 5;
  quote.value = '';
  displayName.value = authStore.currentUser?.displayName || '';
  organization.value = '';
  errorMessage.value = '';
};

watch(
  () => dialogOpen.value,
  (isOpen) => {
    if (isOpen) {
      resetForm();
    }
  }
);

const closeDialog = (): void => {
  dialogOpen.value = false;
};

const validateForm = (): boolean => {
  const trimmedQuote = quote.value.trim();
  const trimmedName = displayName.value.trim();

  if (!trimmedName) {
    errorMessage.value = 'Please enter your name.';
    return false;
  }

  if (trimmedQuote.length < 8) {
    errorMessage.value = 'Please share at least a short sentence (8+ characters).';
    return false;
  }

  if (rating.value < 1 || rating.value > 5) {
    errorMessage.value = 'Please select a rating from 1 to 5.';
    return false;
  }

  errorMessage.value = '';
  return true;
};

const submit = async (): Promise<void> => {
  if (!validateForm()) return;

  await reviewStore.submitReview({
    rating: rating.value,
    quote: quote.value.trim(),
    displayName: displayName.value.trim(),
    organization: organization.value.trim() || undefined,
    source: authStore.isAuthenticated ? 'authenticated' : 'public',
    tournamentId: props.tournamentId || undefined,
    tournamentName: props.tournamentName || undefined,
  });

  emit('submitted');
  closeDialog();
};
</script>

<template>
  <v-dialog
    v-model="dialogOpen"
    max-width="620"
  >
    <v-card>
      <v-card-title class="text-h6">
        Share Your Review
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Reviews are moderated before publication.
        </p>

        <v-select
          v-model="rating"
          label="Rating"
          :items="ratingOptions"
          variant="outlined"
          class="mb-3"
        />

        <v-text-field
          v-model="displayName"
          label="Your Name"
          variant="outlined"
          class="mb-3"
          required
        />

        <v-text-field
          v-model="organization"
          label="Organization (optional)"
          variant="outlined"
          class="mb-3"
        />

        <v-textarea
          v-model="quote"
          label="Review"
          placeholder="What went well for your tournament experience?"
          variant="outlined"
          rows="4"
          auto-grow
          required
        />

        <p
          v-if="errorMessage"
          class="text-error text-body-2 mt-3 mb-0"
          role="alert"
          aria-live="polite"
        >
          {{ errorMessage }}
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="closeDialog"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="reviewStore.submitting"
          @click="submit"
        >
          Submit Review
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

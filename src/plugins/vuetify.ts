// Vuetify Configuration
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

// Custom theme for CourtMaster
const courtmasterTheme = {
  dark: false,
  colors: {
    primary: '#4F46E5', // Indigo
    secondary: '#0EA5E9', // Sky Accent
    accent: '#0EA5E9',
    error: '#FF3B30',
    info: '#007AFF',
    success: '#34C759',
    warning: '#FF9500',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'on-surface': '#0F172A',
    'on-background': '#0F172A',
    // Custom tournament colors
    'tournament-active': '#4CAF50',
    'tournament-draft': '#9E9E9E',
    'tournament-registration': '#0EA5E9',
    'tournament-completed': '#64748B',
    // Match status colors
    'match-scheduled': '#94A3B8',
    'match-ready': '#F59E0B',
    'match-in-progress': '#10B981',
    'match-completed': '#0EA5E9',
  },
};

const courtmasterDarkTheme = {
  dark: true,
  colors: {
    primary: '#4F46E5',
    secondary: '#0EA5E9',
    accent: '#0EA5E9',
    error: '#EF4444',
    info: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    background: '#0F172A', // Dark surface for background
    surface: '#1E293B',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'on-surface': '#F8FAFC',
    'on-background': '#F8FAFC',
    'tournament-active': '#10B981',
    'tournament-draft': '#64748B',
    'tournament-registration': '#0EA5E9',
    'tournament-completed': '#475569',
    'match-scheduled': '#64748B',
    'match-ready': '#F59E0B',
    'match-in-progress': '#10B981',
    'match-completed': '#0EA5E9',
  },
};

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'courtmasterTheme',
    themes: {
      courtmasterTheme,
      courtmasterDarkTheme,
    },
  },
  defaults: {
    global: {
      ripple: false,
    },
    VBtn: {
      variant: 'elevated',
      style: 'border-radius: 8px;',
      ripple: false,
    },
    VListItem: {
      ripple: false,
    },
    VCard: {
      style: 'border-radius: 12px;',
      elevation: 0,
      border: true,
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
    },
    VDataTable: {
      hover: true,
    },
  },
});

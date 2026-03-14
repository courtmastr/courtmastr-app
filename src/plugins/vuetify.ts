// Vuetify Configuration
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

// Custom theme for CourtMastr — Stadium Energy palette
const courtmasterTheme = {
  dark: false,
  colors: {
    primary: '#1D4ED8', // Royal Blue 700
    secondary: '#D97706', // Amber 600
    accent: '#D97706',
    error: '#DC2626',
    info: '#0EA5E9',
    success: '#16A34A',
    warning: '#F97316',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'on-surface': '#0F172A',
    'on-background': '#0F172A',
    // Tournament status colors
    'tournament-active': '#16A34A',
    'tournament-draft': '#9E9E9E',
    'tournament-registration': '#1D4ED8',
    'tournament-completed': '#64748B',
    // Match status colors
    'match-scheduled': '#94A3B8',
    'match-ready': '#D97706',
    'match-in-progress': '#16A34A',
    'match-completed': '#0EA5E9',
  },
};

const courtmasterDarkTheme = {
  dark: true,
  colors: {
    primary: '#3B82F6', // Blue 500 (lighter for dark bg)
    secondary: '#F59E0B', // Amber 500 (lighter for dark bg)
    accent: '#F59E0B',
    error: '#DC2626',
    info: '#0EA5E9',
    success: '#16A34A',
    warning: '#F97316',
    background: '#0F172A',
    surface: '#1E293B',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'on-surface': '#F8FAFC',
    'on-background': '#F8FAFC',
    'tournament-active': '#16A34A',
    'tournament-draft': '#64748B',
    'tournament-registration': '#3B82F6',
    'tournament-completed': '#475569',
    'match-scheduled': '#64748B',
    'match-ready': '#F59E0B',
    'match-in-progress': '#16A34A',
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
    VDialog: {
      scrim: 'black',
      scrimOpacity: 0.5,
    },
  },
});

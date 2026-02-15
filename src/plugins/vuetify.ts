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
    primary: '#1976D2',
    secondary: '#424242',
    accent: '#82B1FF',
    error: '#FF5252',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FFC107',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'on-surface': '#212121',
    'on-background': '#212121',
    // Custom tournament colors
    'tournament-active': '#4CAF50',
    'tournament-draft': '#9E9E9E',
    'tournament-registration': '#2196F3',
    'tournament-completed': '#607D8B',
    // Match status colors
    'match-scheduled': '#9E9E9E',
    'match-ready': '#FF9800',
    'match-in-progress': '#4CAF50',
    'match-completed': '#2196F3',
  },
};

const courtmasterDarkTheme = {
  dark: true,
  colors: {
    primary: '#2196F3',
    secondary: '#616161',
    accent: '#82B1FF',
    error: '#FF5252',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FFC107',
    background: '#121212',
    surface: '#1E1E1E',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'on-surface': '#FFFFFF',
    'on-background': '#FFFFFF',
    'tournament-active': '#4CAF50',
    'tournament-draft': '#757575',
    'tournament-registration': '#2196F3',
    'tournament-completed': '#607D8B',
    'match-scheduled': '#757575',
    'match-ready': '#FF9800',
    'match-in-progress': '#4CAF50',
    'match-completed': '#2196F3',
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
      rounded: 'lg',
      ripple: false,
    },
    VListItem: {
      ripple: false,
    },
    VCard: {
      rounded: 'lg',
      elevation: 2,
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

// Main Entry Point
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { initializeFirebase } from './services/firebase';

// CRITICAL: Initialize Firebase before importing stores to ensure db is defined
initializeFirebase();

// Import the rest after Firebase is initialized
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { useAuthStore } from './stores/auth';
import './style.scss'; // Import global styles

// Unregister service workers in development
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('ServiceWorker unregistered in dev mode');
    }
  });
}

// Create app
const app = createApp(App);

// Install plugins
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(vuetify);

// Initialize auth before mounting
const authStore = useAuthStore();
authStore.initAuth().then(() => {
  app.mount('#app');
});

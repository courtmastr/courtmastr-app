import fs from 'fs';

let content = fs.readFileSync('src/features/tournaments/views/TournamentDashboardView.vue', 'utf-8');

// 1. Add imports
const lucideImports = `import { 
  ArrowLeft, Calendar, MapPin, Settings as SettingsIcon, ChevronDown, 
  UserPlus, Play, CalendarClock, Check, Trash2,
  Zap, Users, Trophy, ClipboardEdit, Lock, Unlock,
  PlayCircle, Medal, ArrowRightCircle, Megaphone, CheckCheck,
  UserCheck, AlertTriangle, Info, GitFork
} from 'lucide-vue-next';`;
content = content.replace(/import { useNotificationStore } from '@\/stores\/notifications';/, `import { useNotificationStore } from '@/stores/notifications';\n${lucideImports}`);

// 2. Replace simple v-icons with direct component
const iconMap = {
    'mdi-arrow-left': 'ArrowLeft',
    'mdi-calendar': 'Calendar',
    'mdi-map-marker': 'MapPin',
    'mdi-calendar-clock': 'CalendarClock',
    'mdi-account-group': 'Users',
    'mdi-tournament': 'GitFork',
    'mdi-whistle': 'Megaphone',
    'mdi-check-all': 'CheckCheck',
    'mdi-alert': 'AlertTriangle',
    'mdi-information': 'Info',
    'mdi-trophy': 'Trophy',
    'mdi-check': 'Check'
};

// Replace bare v-icons with <component> tags
content = content.replace(/<v-icon[^>]*>\s*(mdi-[a-z-]+)\s*<\/v-icon>/g, (match, iconName) => {
    const component = iconMap[iconName];
    if (component) {
        let size = 20;
        if (match.includes('size="small"')) size = 16;
        if (match.includes('size="24"')) size = 24;

        let extraAttr = '';
        if (match.includes('start')) extraAttr += ' class="mr-2"';

        return `<${component} :size="${size}"${extraAttr} />`;
    }
    return match;
});

// 3. Replace prepend-icon in v-btn
const btnIconMap = {
    'mdi-cog': 'SettingsIcon',
    'mdi-play-circle': 'PlayCircle',
    'mdi-tournament': 'GitFork',
    'mdi-account-check': 'UserCheck',
    'mdi-trophy-variant': 'Medal',
    'mdi-arrow-right-circle': 'ArrowRightCircle'
};
Object.keys(btnIconMap).forEach(mdi => {
    const comp = btnIconMap[mdi];
    content = content.replace(new RegExp(`prepend-icon="${mdi}"`, 'g'), `>\n            <template #prepend><${comp} :size="18" /></template`);
    // fix syntax if we injected it improperly:
    content = content.replace(/>\n {12}<template #prepend><[a-zA-Z]+ :size="18" \/><\/template>/g, match => match.replace('</template', '</template>'));
});
// Need to handle self-closing v-btns and nested props better.
// Actually, it's safer to use manual regex for each button block.

content = content.replace(/<v-btn\s+icon="mdi-arrow-left"[^>]*><\/v-btn>/g,
    `<v-btn icon variant="text" density="comfortable" class="mr-2" @click="router.push('/tournaments')"><ArrowLeft :size="20" /></v-btn>`);

content = content.replace(/<v-btn\s+icon="mdi-arrow-left"\s+variant="text"\s+density="comfortable"\s+class="mr-2"\s+@click="router.push\('\/tournaments'\)"\s*\/>/g,
    `<v-btn icon variant="text" density="comfortable" class="mr-2" @click="router.push('/tournaments')"><ArrowLeft :size="20" /></v-btn>`);


content = content.replace(/prepend-icon="mdi-cog"/g, `>\n            <template #prepend><SettingsIcon :size="18" /></template>\n          </v-btn`);
content = content.replace(/append-icon="mdi-chevron-down"/g, `>\n                Manage\n                <template #append><ChevronDown :size="18" /></template>\n              </v-btn`);

// 4. v-list-item prepend icons
const listIconMap = {
    'mdi-account-plus': 'UserPlus',
    'mdi-play': 'Play',
    'mdi-calendar-clock': 'CalendarClock',
    'mdi-check': 'Check',
    'mdi-delete': 'Trash2'
};
Object.keys(listIconMap).forEach(mdi => {
    const comp = listIconMap[mdi];
    content = content.replace(new RegExp(`prepend-icon="${mdi}"`, 'g'), `>\n                <template #prepend><${comp} :size="18" class="mr-3 text-grey-darken-1" /></template>\n              </v-list-item`);
});

// Since regex replace might be messy with vue file formatting, I'll log if something goes wrong.

fs.writeFileSync('src/features/tournaments/views/TournamentDashboardView.vue', content);
console.log('Script completed');

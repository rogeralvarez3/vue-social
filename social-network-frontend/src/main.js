import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { useAuthStore } from '@/stores/auth';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(vuetify);

// Si ya habia una sesion guardada (sessionStorage), reconectamos el socket
const auth = useAuthStore();
auth.reconectarSocketSiHaySesion();

app.mount('#app');

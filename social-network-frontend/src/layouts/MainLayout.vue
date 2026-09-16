<template>
  <v-navigation-drawer v-model="drawer" width="290">
    <ProfileHeader
      :user="auth.user"
      @abrir-perfil="$router.push({ name: 'ajustes' })"
      @cambiar-portada="subirPortada"
    />
    <v-divider />
    <v-list nav density="comfortable">
      <v-list-item
        v-for="item in secciones"
        :key="item.to"
        :to="item.to"
        :prepend-icon="item.icono"
        :title="item.titulo"
        rounded="lg"
        class="mb-1"
      />
    </v-list>
  </v-navigation-drawer>

  <v-app-bar flat color="surface" elevation="1">
    <v-app-bar-nav-icon class="d-md-none" @click="drawer = !drawer" />
    <v-icon icon="mdi-account-group" color="primary" class="ml-2 mr-1" />
    <v-app-bar-title class="font-weight-bold">RedSocial</v-app-bar-title>

    <v-spacer />

    <v-text-field
      v-model="busqueda"
      density="compact"
      variant="solo-filled"
      flat
      hide-details
      placeholder="Buscar personas..."
      prepend-inner-icon="mdi-magnify"
      class="mr-4 search-field"
      style="max-width: 280px"
    />

    <v-btn icon variant="text" @click="alternarTema">
      <v-icon :icon="esOscuro ? 'mdi-white-balance-sunny' : 'mdi-weather-night'" />
    </v-btn>

    <NotificationsMenu />
    <UserMenu class="ml-2 mr-2" />
  </v-app-bar>

  <v-main>
    <router-view />
  </v-main>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useTheme } from 'vuetify';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { obtenerSocket } from '@/services/socket';
import { UsersApi } from '@/services/resources';
import ProfileHeader from '@/components/ProfileHeader.vue';
import NotificationsMenu from '@/components/NotificationsMenu.vue';
import UserMenu from '@/components/UserMenu.vue';

const auth = useAuthStore();
const notifStore = useNotificationsStore();
const drawer = ref(true);
const busqueda = ref('');

const secciones = [
  { to: '/', titulo: 'Publicaciones', icono: 'mdi-post-outline' },
  { to: '/fotos', titulo: 'Fotos', icono: 'mdi-image-multiple-outline' },
  { to: '/videos', titulo: 'Vídeos', icono: 'mdi-video-outline' },
  { to: '/audios', titulo: 'Audios', icono: 'mdi-music-note-outline' },
  { to: '/amigos', titulo: 'Amigos', icono: 'mdi-account-multiple-outline' },
  { to: '/grupos', titulo: 'Grupos', icono: 'mdi-account-group-outline' },
  { to: '/documentos', titulo: 'Documentos', icono: 'mdi-file-document-outline' },
  { to: '/reportes', titulo: 'Reportes', icono: 'mdi-chart-box-outline' }
];

const theme = useTheme();
const esOscuro = ref(theme.global.name.value === 'temaOscuro');
function alternarTema() {
  theme.global.name.value = esOscuro.value ? 'temaClaro' : 'temaOscuro';
  esOscuro.value = !esOscuro.value;
}

async function subirPortada(file) {
  const formData = new FormData();
  formData.append('action', 'actualizar');
  formData.append('cover', file);
  const data = await UsersApi.actualizar(formData);
  auth.actualizarUsuarioLocal(data.user);
}

function manejarNotificacionEnVivo(payload) {
  notifStore.agregarEnVivo(payload);
}

onMounted(() => {
  const socket = obtenerSocket();
  socket?.on('notificacion:nueva', manejarNotificacionEnVivo);
});

onUnmounted(() => {
  const socket = obtenerSocket();
  socket?.off('notificacion:nueva', manejarNotificacionEnVivo);
});
</script>

<style scoped>
.search-field :deep(.v-field) {
  border-radius: 20px;
}
</style>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: menuProps }">
      <v-avatar v-bind="menuProps" size="38" class="cursor-pointer" color="primary">
        <v-img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" cover />
        <span v-else class="text-subtitle-2 font-weight-bold">{{ iniciales }}</span>
      </v-avatar>
    </template>

    <v-list width="230">
      <v-list-item :title="auth.user?.fullName" :subtitle="`@${auth.user?.username}`" />
      <v-divider class="my-1" />
      <v-list-item prepend-icon="mdi-account-edit" title="Editar perfil" @click="ir('ajustes', 'perfil')" />
      <v-list-item prepend-icon="mdi-lock-reset" title="Cambiar contraseña" @click="ir('ajustes', 'password')" />
      <v-list-item prepend-icon="mdi-bell-cog-outline" title="Notificaciones" @click="ir('ajustes', 'notificaciones')" />
      <v-divider class="my-1" />
      <v-list-item prepend-icon="mdi-logout" title="Cerrar sesión" @click="cerrarSesion" />
    </v-list>
  </v-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const iniciales = computed(() => (auth.user?.fullName || auth.user?.username || '?').trim().charAt(0).toUpperCase());

function ir(routeName, tab) {
  router.push({ name: routeName, query: tab ? { tab } : {} });
}

async function cerrarSesion() {
  await auth.cerrarSesion();
  router.push('/login');
}
</script>

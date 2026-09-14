<template>
  <v-container max-width="680">
    <h2 class="text-h6 font-weight-bold mb-4">Configuración de la cuenta</h2>

    <v-tabs v-model="tab" color="primary" class="mb-4">
      <v-tab value="perfil">Editar perfil</v-tab>
      <v-tab value="password">Cambiar contraseña</v-tab>
      <v-tab value="notificaciones">Notificaciones</v-tab>
      <v-tab value="sesion">Cerrar sesión</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <!-- ---------------- EDITAR PERFIL ---------------- -->
      <v-window-item value="perfil">
        <v-card class="pa-5">
          <ProfileHeader :user="auth.user" @cambiar-portada="subirPortada" />
          <v-divider class="my-4" />

          <div class="d-flex align-center ga-4 mb-4">
            <v-avatar size="72" color="primary">
              <v-img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" cover />
              <span v-else class="text-h6 font-weight-bold">{{ inicial }}</span>
            </v-avatar>
            <v-btn variant="tonal" prepend-icon="mdi-camera-outline" @click="avatarInput?.click()">
              Cambiar foto de perfil
            </v-btn>
            <input ref="avatarInput" type="file" accept="image/*" class="d-none" @change="subirAvatar" />
          </div>

          <v-form @submit.prevent="guardarPerfil">
            <v-text-field v-model="perfilForm.fullName" label="Nombre completo" />
            <v-textarea v-model="perfilForm.bio" label="Biografía" rows="3" counter="280" maxlength="280" />
            <v-alert v-if="mensajePerfil" :type="mensajePerfil.tipo" variant="tonal" density="compact" class="mb-3">
              {{ mensajePerfil.texto }}
            </v-alert>
            <v-btn type="submit" color="primary" :loading="guardandoPerfil">Guardar cambios</v-btn>
          </v-form>
        </v-card>
      </v-window-item>

      <!-- ---------------- CAMBIAR CONTRASEÑA ---------------- -->
      <v-window-item value="password">
        <v-card class="pa-5">
          <v-form @submit.prevent="cambiarPassword">
            <v-text-field v-model="passwordForm.currentPassword" label="Contraseña actual" type="password" prepend-inner-icon="mdi-lock-outline" required />
            <v-text-field v-model="passwordForm.newPassword" label="Nueva contraseña (mín. 8 caracteres)" type="password" prepend-inner-icon="mdi-lock-plus-outline" required />
            <v-text-field v-model="passwordForm.confirmPassword" label="Confirmar nueva contraseña" type="password" prepend-inner-icon="mdi-lock-check-outline" required />
            <v-alert v-if="mensajePassword" :type="mensajePassword.tipo" variant="tonal" density="compact" class="mb-3">
              {{ mensajePassword.texto }}
            </v-alert>
            <v-btn type="submit" color="primary" :loading="guardandoPassword">Actualizar contraseña</v-btn>
          </v-form>
        </v-card>
      </v-window-item>

      <!-- ---------------- NOTIFICACIONES ---------------- -->
      <v-window-item value="notificaciones">
        <v-card class="pa-5">
          <p class="text-body-2 text-medium-emphasis mb-4">
            Elige qué actividad quieres recibir como notificación en tiempo real.
            Estas preferencias se guardan en este navegador.
          </p>
          <v-switch v-model="prefs.reaction" color="primary" label="Reacciones a mis publicaciones" hide-details class="mb-2" />
          <v-switch v-model="prefs.comment" color="primary" label="Comentarios en mis publicaciones" hide-details class="mb-2" />
          <v-switch v-model="prefs.reply" color="primary" label="Respuestas a mis comentarios" hide-details class="mb-2" />
          <v-switch v-model="prefs.friend_request" color="primary" label="Solicitudes de amistad" hide-details class="mb-2" />
          <v-switch v-model="prefs.message" color="primary" label="Mensajes privados" hide-details class="mb-4" />
          <v-btn color="primary" @click="guardarPreferencias">Guardar preferencias</v-btn>
          <v-alert v-if="prefsGuardadas" type="success" variant="tonal" density="compact" class="mt-3">
            Preferencias guardadas.
          </v-alert>
        </v-card>
      </v-window-item>

      <!-- ---------------- CERRAR SESIÓN ---------------- -->
      <v-window-item value="sesion">
        <v-card class="pa-5 text-center">
          <v-icon icon="mdi-logout" size="42" color="error" class="mb-3" />
          <p class="text-body-1 mb-4">¿Seguro que quieres cerrar la sesión de <strong>@{{ auth.user?.username }}</strong>?</p>
          <v-btn color="error" prepend-icon="mdi-logout" @click="cerrarSesion">Cerrar sesión</v-btn>
        </v-card>
      </v-window-item>
    </v-window>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { AuthApi, UsersApi } from '@/services/resources';
import ProfileHeader from '@/components/ProfileHeader.vue';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const tab = ref(route.query.tab || 'perfil');
const inicial = computed(() => (auth.user?.fullName || auth.user?.username || '?').charAt(0).toUpperCase());

// ---------- Perfil ----------
const perfilForm = reactive({ fullName: auth.user?.fullName || '', bio: auth.user?.bio || '' });
const guardandoPerfil = ref(false);
const mensajePerfil = ref(null);
const avatarInput = ref(null);

async function guardarPerfil() {
  guardandoPerfil.value = true;
  mensajePerfil.value = null;
  try {
    const formData = new FormData();
    formData.append('action', 'actualizar');
    formData.append('fullName', perfilForm.fullName);
    formData.append('bio', perfilForm.bio);
    const data = await UsersApi.actualizar(formData);
    auth.actualizarUsuarioLocal(data.user);
    mensajePerfil.value = { tipo: 'success', texto: 'Perfil actualizado correctamente.' };
  } catch (err) {
    mensajePerfil.value = { tipo: 'error', texto: err.response?.data?.error || 'No se pudo actualizar el perfil' };
  } finally {
    guardandoPerfil.value = false;
  }
}

async function subirAvatar(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('action', 'actualizar');
  formData.append('avatar', file);
  const data = await UsersApi.actualizar(formData);
  auth.actualizarUsuarioLocal(data.user);
  e.target.value = '';
}

async function subirPortada(file) {
  const formData = new FormData();
  formData.append('action', 'actualizar');
  formData.append('cover', file);
  const data = await UsersApi.actualizar(formData);
  auth.actualizarUsuarioLocal(data.user);
}

// ---------- Contraseña ----------
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const guardandoPassword = ref(false);
const mensajePassword = ref(null);

async function cambiarPassword() {
  mensajePassword.value = null;
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    mensajePassword.value = { tipo: 'error', texto: 'Las contraseñas nuevas no coinciden' };
    return;
  }
  guardandoPassword.value = true;
  try {
    await AuthApi.cambiarPassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword
    });
    mensajePassword.value = { tipo: 'success', texto: 'Contraseña actualizada. Vuelve a iniciar sesión.' };
    setTimeout(async () => {
      await auth.cerrarSesion();
      router.push('/login');
    }, 1500);
  } catch (err) {
    mensajePassword.value = { tipo: 'error', texto: err.response?.data?.error || 'No se pudo cambiar la contraseña' };
  } finally {
    guardandoPassword.value = false;
  }
}

// ---------- Notificaciones (preferencias locales) ----------
const prefs = reactive({ reaction: true, comment: true, reply: true, friend_request: true, message: true });
const prefsGuardadas = ref(false);

function guardarPreferencias() {
  localStorage.setItem('prefs_notificaciones', JSON.stringify(prefs));
  prefsGuardadas.value = true;
  setTimeout(() => (prefsGuardadas.value = false), 2000);
}

onMounted(() => {
  const guardado = localStorage.getItem('prefs_notificaciones');
  if (guardado) Object.assign(prefs, JSON.parse(guardado));
});

// ---------- Cerrar sesión ----------
async function cerrarSesion() {
  await auth.cerrarSesion();
  router.push('/login');
}
</script>

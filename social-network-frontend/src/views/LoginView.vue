<template>
  <v-main class="auth-bg d-flex align-center justify-center">
    <v-card width="420" class="pa-6" elevation="10">
      <div class="text-center mb-4">
        <v-avatar color="primary" size="56" class="mb-2">
          <v-icon icon="mdi-account-group" size="30" color="white" />
        </v-avatar>
        <h1 class="text-h5 font-weight-bold">RedSocial</h1>
        <p class="text-body-2 text-medium-emphasis">Conecta, comparte y descubre</p>
      </div>

      <v-tabs v-model="tab" grow color="primary" class="mb-4">
        <v-tab value="login">Iniciar sesión</v-tab>
        <v-tab value="register">Crear cuenta</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <v-window-item value="login">
          <v-form @submit.prevent="onLogin">
            <v-text-field
              v-model="loginForm.identifier"
              label="Usuario o correo"
              prepend-inner-icon="mdi-account"
              required
            />
            <v-text-field
              v-model="loginForm.password"
              label="Contraseña"
              type="password"
              prepend-inner-icon="mdi-lock"
              required
            />
            <v-alert v-if="auth.error" type="error" variant="tonal" density="compact" class="mb-3">
              {{ auth.error }}
            </v-alert>
            <v-btn type="submit" color="primary" block size="large" :loading="auth.cargando">
              Entrar
            </v-btn>
          </v-form>
        </v-window-item>

        <v-window-item value="register">
          <v-form @submit.prevent="onRegister">
            <v-text-field v-model="registerForm.fullName" label="Nombre completo" prepend-inner-icon="mdi-badge-account" required />
            <v-text-field v-model="registerForm.username" label="Nombre de usuario" prepend-inner-icon="mdi-at" required />
            <v-text-field v-model="registerForm.email" label="Correo electrónico" type="email" prepend-inner-icon="mdi-email" required />

            <p class="text-caption text-medium-emphasis mb-1">¿Te registras como...?</p>
            <v-btn-toggle v-model="registerForm.accountType" color="primary" mandatory divided class="mb-3" density="comfortable">
              <v-btn value="personal" prepend-icon="mdi-account">Persona</v-btn>
              <v-btn value="negocio" prepend-icon="mdi-storefront-outline">Negocio</v-btn>
            </v-btn-toggle>
            <div class="d-flex ga-2">
              <v-text-field v-model="registerForm.country" label="País" prepend-inner-icon="mdi-earth" required />
              <v-text-field v-model="registerForm.city" label="Ciudad" prepend-inner-icon="mdi-city" required />
            </div>
            <p class="text-caption text-medium-emphasis mt-n2 mb-2">
              Tu feed de publicaciones mostrará por defecto solo lo de tu ciudad; podrás ampliarlo cuando quieras.
            </p>
            <v-text-field v-model="registerForm.password" label="Contraseña (mín. 8 caracteres)" type="password" prepend-inner-icon="mdi-lock" required />
            <v-alert v-if="auth.error" type="error" variant="tonal" density="compact" class="mb-3">
              {{ auth.error }}
            </v-alert>
            <v-btn type="submit" color="secondary" block size="large" :loading="auth.cargando">
              Registrarme
            </v-btn>
          </v-form>
        </v-window-item>
      </v-window>
    </v-card>
  </v-main>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const tab = ref('login');

const loginForm = reactive({ identifier: '', password: '' });
const registerForm = reactive({ fullName: '', username: '', email: '', password: '', country: '', city: '', accountType: 'personal' });

async function onLogin() {
  const ok = await auth.login(loginForm.identifier, loginForm.password);
  if (ok) router.push('/');
}

async function onRegister() {
  const ok = await auth.registrar({ ...registerForm });
  if (ok) router.push('/');
}
</script>

<style scoped>
.auth-bg {
  min-height: 100vh;
  background: linear-gradient(135deg, #4f5bd5 0%, #00c2a8 100%);
}
</style>

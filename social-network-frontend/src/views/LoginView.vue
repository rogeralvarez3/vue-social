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
const registerForm = reactive({ fullName: '', username: '', email: '', password: '' });

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

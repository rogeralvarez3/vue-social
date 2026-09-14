<template>
  <v-container max-width="760">
    <v-tabs v-model="tab" color="primary" class="mb-4">
      <v-tab value="amigos">Mis amigos</v-tab>
      <v-tab value="recibidas">
        Solicitudes
        <v-badge v-if="recibidas.length" :content="recibidas.length" color="error" inline />
      </v-tab>
      <v-tab value="enviadas">Enviadas</v-tab>
      <v-tab value="buscar">Buscar personas</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="amigos">
        <v-row>
          <v-col v-for="u in amigos" :key="u.user_id" cols="12" sm="6" md="4">
            <v-card class="pa-3 d-flex align-center ga-3">
              <v-avatar color="primary" size="46">
                <v-img v-if="u.avatar_url" :src="u.avatar_url" cover />
                <span v-else>{{ (u.full_name || u.username).charAt(0).toUpperCase() }}</span>
              </v-avatar>
              <div>
                <div class="font-weight-bold">{{ u.full_name }}</div>
                <div class="text-caption text-medium-emphasis">@{{ u.username }}</div>
              </div>
            </v-card>
          </v-col>
        </v-row>
        <p v-if="!amigos.length" class="text-medium-emphasis text-center py-8">Todavía no tienes amigos agregados.</p>
      </v-window-item>

      <v-window-item value="recibidas">
        <v-list>
          <v-list-item v-for="s in recibidas" :key="s.id">
            <template #prepend>
              <v-avatar color="primary"><span>{{ (s.full_name || s.username).charAt(0).toUpperCase() }}</span></v-avatar>
            </template>
            <v-list-item-title>{{ s.full_name }} (@{{ s.username }})</v-list-item-title>
            <template #append>
              <v-btn size="small" color="primary" class="mr-2" @click="responder(s.id, 'accepted')">Aceptar</v-btn>
              <v-btn size="small" variant="text" @click="responder(s.id, 'rejected')">Rechazar</v-btn>
            </template>
          </v-list-item>
        </v-list>
        <p v-if="!recibidas.length" class="text-medium-emphasis text-center py-8">No tienes solicitudes pendientes.</p>
      </v-window-item>

      <v-window-item value="enviadas">
        <v-list>
          <v-list-item v-for="s in enviadas" :key="s.id" :title="`${s.full_name} (@${s.username})`" subtitle="Pendiente de respuesta" />
        </v-list>
        <p v-if="!enviadas.length" class="text-medium-emphasis text-center py-8">No has enviado solicitudes.</p>
      </v-window-item>

      <v-window-item value="buscar">
        <v-text-field v-model="q" prepend-inner-icon="mdi-magnify" placeholder="Buscar por nombre o usuario" @update:model-value="buscar" />
        <v-list>
          <v-list-item v-for="u in resultados" :key="u.id">
            <template #prepend>
              <v-avatar color="primary"><span>{{ (u.fullName || u.username).charAt(0).toUpperCase() }}</span></v-avatar>
            </template>
            <v-list-item-title>{{ u.fullName }} (@{{ u.username }})</v-list-item-title>
            <template #append>
              <v-btn size="small" color="primary" @click="enviarSolicitud(u.id)">Agregar</v-btn>
            </template>
          </v-list-item>
        </v-list>
      </v-window-item>
    </v-window>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { FriendsApi, UsersApi } from '@/services/resources';

const tab = ref('amigos');
const amigos = ref([]);
const recibidas = ref([]);
const enviadas = ref([]);
const q = ref('');
const resultados = ref([]);

async function cargarTodo() {
  const [a, r, e] = await Promise.all([
    FriendsApi.listar('amigos'),
    FriendsApi.listar('pendientes_recibidas'),
    FriendsApi.listar('pendientes_enviadas')
  ]);
  amigos.value = a.resultados;
  recibidas.value = r.resultados;
  enviadas.value = e.resultados;
}

async function responder(id, status) {
  await FriendsApi.actualizar(id, status);
  cargarTodo();
}

let timeoutId = null;
function buscar() {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(async () => {
    if (!q.value.trim()) { resultados.value = []; return; }
    const data = await UsersApi.listar({ q: q.value.trim() });
    resultados.value = data.users;
  }, 300);
}

async function enviarSolicitud(id) {
  await FriendsApi.crear(id);
  resultados.value = resultados.value.filter((u) => u.id !== id);
  cargarTodo();
}

onMounted(cargarTodo);
</script>

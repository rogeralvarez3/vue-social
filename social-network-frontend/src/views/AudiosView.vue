<template>
  <v-container max-width="760">
    <div class="d-flex align-center justify-space-between mb-4">
      <h2 class="text-h6 font-weight-bold">Audios</h2>
      <v-btn color="primary" prepend-icon="mdi-upload" @click="fileInput?.click()">
        Subir audio
      </v-btn>
      <input ref="fileInput" type="file" accept="audio/*" class="d-none" @change="subir" />
    </div>

    <v-list lines="two">
      <v-list-item v-for="item in items" :key="item.id">
        <template #prepend>
          <v-avatar color="secondary">
            <v-icon icon="mdi-music-note" color="white" />
          </v-avatar>
        </template>
        <v-list-item-title>{{ item.caption || item.author?.username }}</v-list-item-title>
        <v-list-item-subtitle>
          <audio :src="item.url" controls class="w-100 mt-1" style="height: 34px" />
        </v-list-item-subtitle>
        <template #append>
          <v-btn v-if="item.userId === auth.user?.id" icon="mdi-delete-outline" size="small" variant="text" @click="borrar(item.id)" />
        </template>
      </v-list-item>
    </v-list>
    <p v-if="!items.length" class="text-medium-emphasis text-center py-8">Todavía no hay audios. ¡Sube el primero!</p>
  </v-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { MediaApi } from '@/services/resources';
import { obtenerSocket } from '@/services/socket';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const items = ref([]);
const fileInput = ref(null);

async function cargar() {
  const data = await MediaApi.listar({ type: 'audio', page: 1, limit: 48 });
  items.value = data.media;
}

async function subir(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('action', 'crear');
  formData.append('type', 'audio');
  formData.append('file', file);
  await MediaApi.crear(formData);
  e.target.value = '';
  cargar();
}

async function borrar(id) {
  await MediaApi.borrar(id);
  cargar();
}

function enVivo(payload) {
  if (payload.type === 'audio') cargar();
}

onMounted(() => {
  cargar();
  const socket = obtenerSocket();
  socket?.on('media:nuevo', enVivo);
});

onUnmounted(() => {
  const socket = obtenerSocket();
  socket?.off('media:nuevo', enVivo);
});
</script>

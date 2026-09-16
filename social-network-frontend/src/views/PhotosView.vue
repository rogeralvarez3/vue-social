<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-4">
      <h2 class="text-h6 font-weight-bold">Fotos</h2>
      <v-btn color="primary" prepend-icon="mdi-upload" @click="fileInput?.click()">
        Subir foto
      </v-btn>
      <input ref="fileInput" type="file" accept="image/*" class="d-none" @change="subir" />
    </div>

    <v-row v-if="items.length">
      <v-col v-for="item in items" :key="item.id" cols="6" sm="4" md="3">
        <v-card>
          <v-img :src="item.url" aspect-ratio="1" cover />
          <v-card-actions class="justify-space-between">
            <span class="text-caption text-truncate">{{ item.caption || item.author?.username }}</span>
            <v-btn v-if="item.userId === auth.user?.id" icon="mdi-delete-outline" size="small" variant="text" @click="borrar(item.id)" />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
    <p v-else class="text-medium-emphasis text-center py-8">Todavía no hay fotos. ¡Sube la primera!</p>
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
  const data = await MediaApi.listar({ type: 'photo', page: 1, limit: 48 });
  items.value = data.media;
}

async function subir(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('action', 'crear');
  formData.append('type', 'photo');
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
  if (payload.type === 'photo') cargar();
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

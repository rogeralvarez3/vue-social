<template>
  <v-card class="pa-4 mb-4">
    <div class="d-flex ga-3">
      <v-avatar size="42" color="primary">
        <v-img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" cover />
        <span v-else class="font-weight-bold">{{ inicial }}</span>
      </v-avatar>
      <v-textarea
        v-model="contenido"
        rows="2"
        auto-grow
        hide-details
        placeholder="¿Qué estás pensando?"
      />
    </div>

    <v-img v-if="tipoArchivo === 'photo' && previewUrl" :src="previewUrl" max-height="260" class="rounded-lg mt-3" cover />
    <video v-if="tipoArchivo === 'video' && previewUrl" :src="previewUrl" controls class="w-100 rounded-lg mt-3" style="max-height: 300px; background: black" />
    <audio v-if="tipoArchivo === 'audio' && previewUrl" :src="previewUrl" controls class="w-100 mt-3" />

    <div v-if="previewUrl" class="d-flex justify-end mt-1">
      <v-btn size="small" variant="text" prepend-icon="mdi-close" @click="quitarArchivo">Quitar</v-btn>
    </div>

    <v-divider class="my-3" />

    <div class="d-flex align-center justify-space-between flex-wrap ga-2">
      <div class="d-flex ga-1">
        <v-btn variant="text" prepend-icon="mdi-image-outline" color="success" @click="abrirSelector('photo')">
          Foto
        </v-btn>
        <v-btn variant="text" prepend-icon="mdi-video-outline" color="error" @click="abrirSelector('video')">
          Vídeo
        </v-btn>
        <v-btn variant="text" prepend-icon="mdi-microphone-outline" color="info" @click="abrirSelector('audio')">
          Audio
        </v-btn>
      </div>
      <input ref="fileInput" type="file" :accept="aceptaSegunTipo" class="d-none" @change="onFile" />
      <v-btn color="primary" :disabled="!puedePublicar" :loading="publicando" @click="publicar">
        Publicar
      </v-btn>
    </div>
  </v-card>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { PostsApi } from '@/services/resources';

const emit = defineEmits(['publicado']);
const auth = useAuthStore();

const contenido = ref('');
const archivo = ref(null);
const previewUrl = ref(null);
const tipoArchivo = ref(null); // 'photo' | 'video' | 'audio'
const fileInput = ref(null);
const publicando = ref(false);

const inicial = computed(() => (auth.user?.fullName || auth.user?.username || '?').charAt(0).toUpperCase());
const puedePublicar = computed(() => contenido.value.trim().length > 0 || archivo.value);

const aceptaSegunTipo = computed(() => {
  if (tipoArchivo.value === 'video') return 'video/*';
  if (tipoArchivo.value === 'audio') return 'audio/*';
  return 'image/*';
});

function abrirSelector(tipo) {
  tipoArchivo.value = tipo;
  // El "accept" del input se actualiza antes de abrir el selector de archivos
  requestAnimationFrame(() => fileInput.value?.click());
}

function onFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  archivo.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

function quitarArchivo() {
  archivo.value = null;
  previewUrl.value = null;
  tipoArchivo.value = null;
  if (fileInput.value) fileInput.value.value = '';
}

async function publicar() {
  publicando.value = true;
  try {
    if (archivo.value) {
      const formData = new FormData();
      formData.append('action', 'crear');
      formData.append('content', contenido.value);
      formData.append('media', archivo.value);
      await PostsApi.crear(formData);
    } else {
      await PostsApi.crear({ content: contenido.value });
    }
    contenido.value = '';
    quitarArchivo();
    emit('publicado');
  } finally {
    publicando.value = false;
  }
}
</script>

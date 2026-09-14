<template>
  <v-container max-width="760">
    <div class="d-flex align-center justify-space-between mb-4">
      <h2 class="text-h6 font-weight-bold">Documentos</h2>
      <v-btn color="primary" prepend-icon="mdi-upload" @click="fileInput?.click()">Subir documento</v-btn>
      <input ref="fileInput" type="file" class="d-none" @change="subir" />
    </div>

    <v-list lines="two">
      <v-list-item v-for="d in documentos" :key="d.id">
        <template #prepend>
          <v-avatar color="primary"><v-icon :icon="iconoPara(d.mimeType)" color="white" /></v-avatar>
        </template>
        <v-list-item-title>{{ d.filename }}</v-list-item-title>
        <v-list-item-subtitle>{{ formatearTamano(d.sizeBytes) }} · {{ formatear(d.createdAt) }}</v-list-item-subtitle>
        <template #append>
          <v-btn icon="mdi-download" variant="text" :href="d.url" target="_blank" />
          <v-btn icon="mdi-delete-outline" variant="text" @click="borrar(d.id)" />
        </template>
      </v-list-item>
    </v-list>
    <p v-if="!documentos.length" class="text-medium-emphasis text-center py-8">No has subido documentos todavía.</p>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { DocumentsApi } from '@/services/resources';

const documentos = ref([]);
const fileInput = ref(null);

async function cargar() {
  const data = await DocumentsApi.listar({ page: 1, limit: 50 });
  documentos.value = data.documents;
}

async function subir(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('action', 'crear');
  formData.append('file', file);
  await DocumentsApi.crear(formData);
  e.target.value = '';
  cargar();
}

async function borrar(id) {
  await DocumentsApi.borrar(id);
  cargar();
}

function iconoPara(mime) {
  if (!mime) return 'mdi-file-outline';
  if (mime.includes('pdf')) return 'mdi-file-pdf-box';
  if (mime.includes('word')) return 'mdi-file-word-box';
  if (mime.includes('sheet') || mime.includes('excel')) return 'mdi-file-excel-box';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'mdi-file-powerpoint-box';
  if (mime.includes('zip')) return 'mdi-folder-zip-outline';
  return 'mdi-file-outline';
}

function formatearTamano(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatear(iso) {
  return new Date(iso).toLocaleDateString();
}

onMounted(cargar);
</script>

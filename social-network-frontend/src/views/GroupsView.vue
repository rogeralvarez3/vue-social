<template>
  <v-container max-width="900">
    <div class="d-flex align-center justify-space-between mb-4">
      <h2 class="text-h6 font-weight-bold">Grupos</h2>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="dialogo = true">Crear grupo</v-btn>
    </div>

    <v-row>
      <v-col v-for="g in grupos" :key="g.id" cols="12" sm="6" md="4">
        <v-card>
          <v-img :src="g.coverUrl || undefined" height="110" cover class="bg-primary">
            <template v-if="!g.coverUrl" #default>
              <div class="fill-height d-flex align-center justify-center">
                <v-icon icon="mdi-account-group" size="42" color="white" />
              </div>
            </template>
          </v-img>
          <v-card-item>
            <v-card-title>{{ g.name }}</v-card-title>
            <v-card-subtitle>{{ g.membersCount }} miembros · {{ g.privacy === 'public' ? 'Público' : 'Privado' }}</v-card-subtitle>
          </v-card-item>
          <v-card-text class="text-body-2 text-truncate">{{ g.description }}</v-card-text>
          <v-card-actions>
            <v-btn v-if="!g.isMember" color="primary" variant="tonal" block @click="unirse(g.id)">Unirme</v-btn>
            <v-btn v-else color="success" variant="tonal" block prepend-icon="mdi-check" @click="salir(g.id)">Eres miembro</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
    <p v-if="!grupos.length" class="text-medium-emphasis text-center py-8">Aún no hay grupos creados.</p>

    <v-dialog v-model="dialogo" max-width="480">
      <v-card class="pa-4">
        <v-card-title>Crear grupo</v-card-title>
        <v-form @submit.prevent="crear">
          <v-text-field v-model="nuevo.name" label="Nombre del grupo" required />
          <v-textarea v-model="nuevo.description" label="Descripción" rows="2" />
          <v-select v-model="nuevo.privacy" label="Privacidad" :items="[{ title: 'Público', value: 'public' }, { title: 'Privado', value: 'private' }]" />
          <v-btn type="submit" color="primary" block :loading="creando">Crear</v-btn>
        </v-form>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { GroupsApi } from '@/services/resources';

const grupos = ref([]);
const dialogo = ref(false);
const creando = ref(false);
const nuevo = reactive({ name: '', description: '', privacy: 'public' });

async function cargar() {
  const data = await GroupsApi.listar({ page: 1, limit: 30 });
  grupos.value = data.groups;
}

async function crear() {
  creando.value = true;
  try {
    const formData = new FormData();
    formData.append('action', 'crear');
    formData.append('name', nuevo.name);
    formData.append('description', nuevo.description);
    formData.append('privacy', nuevo.privacy);
    await GroupsApi.crear(formData);
    dialogo.value = false;
    nuevo.name = ''; nuevo.description = ''; nuevo.privacy = 'public';
    cargar();
  } finally {
    creando.value = false;
  }
}

async function unirse(id) {
  await GroupsApi.unirse(id);
  cargar();
}
async function salir(id) {
  await GroupsApi.salir(id);
  cargar();
}

onMounted(cargar);
</script>

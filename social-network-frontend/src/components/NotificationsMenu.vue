<template>
  <v-menu v-model="abierto" location="bottom end" :close-on-content-click="false" width="360">
    <template #activator="{ props: menuProps }">
      <v-btn icon variant="text" v-bind="menuProps">
        <v-badge :content="store.sinLeer" :model-value="store.sinLeer > 0" color="error">
          <v-icon icon="mdi-bell-outline" />
        </v-badge>
      </v-btn>
    </template>

    <v-card width="360" max-height="420" class="d-flex flex-column">
      <v-card-title class="d-flex align-center justify-space-between py-2">
        <span class="text-subtitle-1 font-weight-bold">Notificaciones</span>
        <v-btn size="small" variant="text" color="primary" @click="store.marcarTodasLeidas()">
          Marcar todas
        </v-btn>
      </v-card-title>
      <v-divider />
      <v-list class="overflow-y-auto" lines="two">
        <v-list-item v-if="store.items.length === 0">
          <v-list-item-title class="text-medium-emphasis">Sin notificaciones por ahora</v-list-item-title>
        </v-list-item>
        <v-list-item
          v-for="n in store.items"
          :key="n.id"
          :class="{ 'bg-primary-lighten-5': !n.is_read }"
        >
          <template #prepend>
            <v-avatar size="36" color="primary">
              <v-icon :icon="iconoPara(n.type)" color="white" size="18" />
            </v-avatar>
          </template>
          <v-list-item-title class="text-body-2">{{ textoPara(n) }}</v-list-item-title>
          <v-list-item-subtitle>{{ formatearFecha(n.created_at) }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-card>
  </v-menu>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useNotificationsStore } from '@/stores/notifications';

const store = useNotificationsStore();
const abierto = ref(false);

const textos = {
  reaction: 'reaccionó a tu publicación',
  comment: 'comentó tu publicación',
  reply: 'respondió a tu comentario',
  friend_request: 'te envió una solicitud de amistad',
  friend_accept: 'aceptó tu solicitud de amistad',
  message: 'te envió un mensaje'
};

const iconos = {
  reaction: 'mdi-thumb-up',
  comment: 'mdi-comment-text',
  reply: 'mdi-reply',
  friend_request: 'mdi-account-plus',
  friend_accept: 'mdi-account-check',
  message: 'mdi-message'
};

function textoPara(n) {
  return textos[n.type] || 'interactuó contigo';
}
function iconoPara(tipo) {
  return iconos[tipo] || 'mdi-bell';
}
function formatearFecha(iso) {
  return new Date(iso).toLocaleString();
}

onMounted(() => store.cargar());
</script>

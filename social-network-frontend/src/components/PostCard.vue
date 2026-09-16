<template>
  <v-card class="mb-4">
    <v-card-item>
      <template #prepend>
        <v-avatar color="primary" size="42">
          <v-img v-if="post.author?.avatarUrl" :src="post.author.avatarUrl" cover />
          <span v-else class="font-weight-bold">{{ inicial }}</span>
        </v-avatar>
      </template>
      <v-card-title class="text-subtitle-1 d-flex align-center ga-1">
        {{ post.author?.fullName || post.author?.username }}
        <v-icon v-if="post.author?.accountType === 'negocio'" icon="mdi-storefront-outline" size="16" color="primary" />
      </v-card-title>
      <v-card-subtitle>
        {{ formatear(post.createdAt) }}
        <span v-if="post.author?.city"> · {{ post.author.city }}</span>
      </v-card-subtitle>
    </v-card-item>

    <v-card-text class="pt-0">
      <p class="text-body-1" style="white-space: pre-wrap">{{ post.content }}</p>
    </v-card-text>

    <v-img v-if="post.mediaType === 'photo'" :src="post.mediaUrl" max-height="420" cover />
    <video v-else-if="post.mediaType === 'video'" :src="post.mediaUrl" controls class="w-100" style="max-height: 480px; background: black" />
    <audio v-else-if="post.mediaType === 'audio'" :src="post.mediaUrl" controls class="w-100 px-4 pb-2" />

    <v-card-text v-if="totalReacciones > 0 || post.commentsCount > 0" class="d-flex justify-space-between text-caption text-medium-emphasis py-2">
      <span v-if="totalReacciones > 0">{{ resumenEmojis }} {{ totalReacciones }}</span>
      <span v-else />
      <span v-if="post.commentsCount">{{ post.commentsCount }} comentarios</span>
    </v-card-text>

    <v-divider />

    <v-card-actions>
      <ReactionPicker :mi-reaccion="miReaccion" @reaccionar="reaccionar" @quitar="quitarReaccion" />
      <v-btn variant="text" prepend-icon="mdi-comment-outline" @click="mostrarComentarios = !mostrarComentarios">
        Comentar
      </v-btn>
    </v-card-actions>

    <v-expand-transition>
      <v-card-text v-if="mostrarComentarios" class="pt-0">
        <CommentTree :post-id="post.id" />
      </v-card-text>
    </v-expand-transition>
  </v-card>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ReactionsApi } from '@/services/resources';
import { obtenerSocket } from '@/services/socket';
import { useAuthStore } from '@/stores/auth';
import ReactionPicker from '@/components/ReactionPicker.vue';
import CommentTree from '@/components/CommentTree.vue';

const props = defineProps({
  post: { type: Object, required: true }
});

const auth = useAuthStore();
const mostrarComentarios = ref(false);
const resumen = ref({ like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 });
const miReaccion = ref(null);

const inicial = computed(() => (props.post.author?.fullName || props.post.author?.username || '?').charAt(0).toUpperCase());
const totalReacciones = computed(() => Object.values(resumen.value).reduce((a, b) => a + b, 0));
const resumenEmojis = computed(() => {
  const emojis = { like: '👍', love: '❤️', haha: '😆', wow: '😮', sad: '😢', angry: '😡' };
  return Object.entries(resumen.value)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tipo]) => emojis[tipo])
    .join(' ');
});

function formatear(iso) {
  return new Date(iso).toLocaleString();
}

async function cargarReacciones() {
  const data = await ReactionsApi.listar(props.post.id);
  resumen.value = data.resumen;
  const mia = data.usuarios.find((u) => u.id === auth.user?.id);
  miReaccion.value = mia?.type || null;
}

async function reaccionar(type) {
  miReaccion.value = type;
  await ReactionsApi.crear(props.post.id, type);
  await cargarReacciones();
}

async function quitarReaccion() {
  miReaccion.value = null;
  await ReactionsApi.borrar(props.post.id);
  await cargarReacciones();
}

function enVivo(payload) {
  if (payload.postId === props.post.id) cargarReacciones();
}

onMounted(() => {
  cargarReacciones();
  const socket = obtenerSocket();
  socket?.on('reaccion:nueva', enVivo);
  socket?.on('reaccion:borrada', enVivo);
});

onUnmounted(() => {
  const socket = obtenerSocket();
  socket?.off('reaccion:nueva', enVivo);
  socket?.off('reaccion:borrada', enVivo);
});
</script>

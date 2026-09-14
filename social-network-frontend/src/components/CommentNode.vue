<template>
  <div class="comment-node" :style="{ marginLeft: nivel > 0 ? '28px' : '0' }">
    <div class="d-flex">
      <v-avatar size="30" color="primary" class="mr-2 mt-1">
        <v-img v-if="comentario.author?.avatarUrl" :src="comentario.author.avatarUrl" cover />
        <span v-else class="text-caption font-weight-bold">{{ inicial }}</span>
      </v-avatar>

      <div class="flex-grow-1">
        <div class="comment-bubble">
          <div class="text-caption font-weight-bold">{{ comentario.author?.fullName || comentario.author?.username }}</div>
          <div class="text-body-2">{{ comentario.content }}</div>
        </div>
        <div class="d-flex align-center ga-3 mt-1 ml-2">
          <span class="text-caption text-medium-emphasis">{{ formatear(comentario.createdAt) }}</span>
          <v-btn variant="text" size="x-small" density="compact" class="pa-0" @click="mostrarRespuesta = !mostrarRespuesta">
            Responder
          </v-btn>
        </div>

        <div v-if="mostrarRespuesta" class="d-flex mt-2 ga-2">
          <v-text-field
            v-model="textoRespuesta"
            density="compact"
            hide-details
            placeholder="Escribe una respuesta..."
            @keyup.enter="enviarRespuesta"
          />
          <v-btn icon="mdi-send" size="small" color="primary" variant="text" @click="enviarRespuesta" />
        </div>

        <!-- Recursion: cada respuesta es a su vez un CommentNode -->
        <CommentNode
          v-for="hijo in comentario.replies"
          :key="hijo.id"
          :comentario="hijo"
          :post-id="postId"
          :nivel="nivel + 1"
          @responder="(payload) => $emit('responder', payload)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  comentario: { type: Object, required: true },
  postId: { type: String, required: true },
  nivel: { type: Number, default: 0 }
});
const emit = defineEmits(['responder']);

const mostrarRespuesta = ref(false);
const textoRespuesta = ref('');

const inicial = computed(() => (props.comentario.author?.fullName || props.comentario.author?.username || '?').charAt(0).toUpperCase());

function formatear(iso) {
  return new Date(iso).toLocaleString();
}

function enviarRespuesta() {
  if (!textoRespuesta.value.trim()) return;
  emit('responder', { postId: props.postId, parentId: props.comentario.id, content: textoRespuesta.value.trim() });
  textoRespuesta.value = '';
  mostrarRespuesta.value = false;
}
</script>

<style scoped>
.comment-bubble {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 14px;
  padding: 6px 12px;
  display: inline-block;
}
.comment-node {
  margin-top: 10px;
}
</style>

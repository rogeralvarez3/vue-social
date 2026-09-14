<template>
  <div class="mt-3">
    <div class="d-flex ga-2 mb-2">
      <v-text-field
        v-model="nuevoComentario"
        density="compact"
        hide-details
        placeholder="Escribe un comentario..."
        @keyup.enter="enviarComentario"
      />
      <v-btn icon="mdi-send" color="primary" variant="text" @click="enviarComentario" />
    </div>

    <CommentNode
      v-for="c in comentarios"
      :key="c.id"
      :comentario="c"
      :post-id="postId"
      :nivel="0"
      @responder="responder"
    />

    <p v-if="comentarios.length === 0" class="text-caption text-medium-emphasis mt-2">
      Sé el primero en comentar.
    </p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { CommentsApi } from '@/services/resources';
import { obtenerSocket } from '@/services/socket';
import CommentNode from '@/components/CommentNode.vue';

const props = defineProps({
  postId: { type: String, required: true }
});

const comentarios = ref([]);
const nuevoComentario = ref('');

async function cargar() {
  const data = await CommentsApi.listar(props.postId);
  comentarios.value = data.comments;
}

async function enviarComentario() {
  if (!nuevoComentario.value.trim()) return;
  await CommentsApi.crear({ postId: props.postId, content: nuevoComentario.value.trim() });
  nuevoComentario.value = '';
  await cargar();
}

async function responder({ postId, parentId, content }) {
  await CommentsApi.crear({ postId, parentId, content });
  await cargar();
}

function insertarEnVivo(comentario) {
  if (comentario.postId !== props.postId) return;
  // Volvemos a pedir el arbol completo: es la forma mas simple de mantener
  // la estructura correcta cuando llegan respuestas anidadas por socket.
  cargar();
}

onMounted(() => {
  cargar();
  const socket = obtenerSocket();
  socket?.on('comentario:nuevo', insertarEnVivo);
});
</script>

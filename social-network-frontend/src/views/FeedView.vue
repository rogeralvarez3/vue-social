<template>
  <v-container max-width="620">
    <NewPostForm @publicado="cargar" />

    <div v-if="cargando" class="text-center py-6">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <PostCard v-for="post in posts" :key="post.id" :post="post" />

    <p v-if="!cargando && posts.length === 0" class="text-center text-medium-emphasis py-8">
      Aún no hay publicaciones. ¡Sé el primero en compartir algo!
    </p>
  </v-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { PostsApi } from '@/services/resources';
import { obtenerSocket } from '@/services/socket';
import NewPostForm from '@/components/NewPostForm.vue';
import PostCard from '@/components/PostCard.vue';

const posts = ref([]);
const cargando = ref(true);

async function cargar() {
  cargando.value = true;
  try {
    const data = await PostsApi.listar({ page: 1, limit: 20 });
    posts.value = data.posts;
  } finally {
    cargando.value = false;
  }
}

function agregarEnVivo(post) {
  posts.value.unshift(post);
}

onMounted(() => {
  cargar();
  const socket = obtenerSocket();
  socket?.on('post:nuevo', agregarEnVivo);
});

onUnmounted(() => {
  const socket = obtenerSocket();
  socket?.off('post:nuevo', agregarEnVivo);
});
</script>

<template>
  <v-container max-width="620">
    <NewPostForm @publicado="reiniciarYCargar" />

    <!-- Selector de alcance: mi ciudad / todas las ciudades / una ciudad especifica -->
    <v-card class="pa-2 mb-4 d-flex align-center justify-space-between flex-wrap ga-2">
      <v-menu v-model="menuAbierto" location="bottom start" :close-on-content-click="false">
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" variant="tonal" color="primary" prepend-icon="mdi-map-marker-outline">
            {{ etiquetaAlcance }}
          </v-btn>
        </template>

        <v-card width="300" class="pa-2">
          <v-list density="compact">
            <v-list-item
              :active="alcance === 'mi_ciudad'"
              color="primary"
              prepend-icon="mdi-home-city-outline"
              :title="miCiudad ? `Mi ciudad (${miCiudad})` : 'Mi ciudad'"
              :disabled="!miCiudad"
              @click="elegirAlcance('mi_ciudad')"
            />
            <v-list-item
              :active="alcance === 'todas'"
              color="primary"
              prepend-icon="mdi-earth"
              title="Todas las ciudades"
              @click="elegirAlcance('todas')"
            />
          </v-list>

          <v-divider class="my-2" />

          <p class="text-caption text-medium-emphasis mb-1 px-2">O elige otra ciudad:</p>
          <v-select
            v-model="ciudadSeleccionada"
            :items="ciudadesDisponibles"
            item-title="label"
            item-value="city"
            density="compact"
            hide-details
            placeholder="Selecciona una ciudad"
            class="px-2"
            @update:model-value="elegirCiudadEspecifica"
          />
        </v-card>
      </v-menu>

      <span class="text-caption text-medium-emphasis mr-2">
        {{ posts.length }} publicaci{{ posts.length === 1 ? 'ón' : 'ones' }} cargadas
      </span>
    </v-card>

    <div v-if="cargandoInicial" class="text-center py-6">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <PostCard v-for="post in posts" :key="post.id" :post="post" />

    <!-- Centinela para el scroll infinito -->
    <div ref="centinela" class="py-4 text-center">
      <v-progress-circular v-if="cargandoMas" indeterminate size="28" color="primary" />
      <span v-else-if="!hayMas && posts.length" class="text-caption text-medium-emphasis">
        No hay más publicaciones por aquí.
      </span>
    </div>

    <p v-if="!cargandoInicial && posts.length === 0" class="text-center text-medium-emphasis py-8">
      Aún no hay publicaciones en este alcance. ¡Sé el primero en compartir algo, o prueba "Todas las ciudades"!
    </p>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { PostsApi, UsersApi } from '@/services/resources';
import { obtenerSocket } from '@/services/socket';
import { useAuthStore } from '@/stores/auth';
import NewPostForm from '@/components/NewPostForm.vue';
import PostCard from '@/components/PostCard.vue';

const LIMITE_POR_PAGINA = 10;
const CLAVE_LOCALSTORAGE = 'feed_alcance';

const auth = useAuthStore();
const miCiudad = computed(() => auth.user?.city || null);

const posts = ref([]);
const pagina = ref(1);
const hayMas = ref(true);
const cargandoInicial = ref(true);
const cargandoMas = ref(false);

const alcance = ref('mi_ciudad'); // 'mi_ciudad' | 'todas' | 'ciudad_especifica'
const ciudadSeleccionada = ref(null);
const ciudadesDisponibles = ref([]);
const menuAbierto = ref(false);

const centinela = ref(null);
let observer = null;

// Se lee la preferencia guardada de forma sincrona, ANTES de declarar el
// watch de mas abajo, para que no dispare una carga doble al montar la vista.
cargarPreferenciaInicial();

function cargarPreferenciaInicial() {
  const guardado = localStorage.getItem(CLAVE_LOCALSTORAGE);
  if (!guardado) return;
  try {
    const { alcance: a, ciudad } = JSON.parse(guardado);
    if (a) alcance.value = a;
    if (ciudad) ciudadSeleccionada.value = ciudad;
  } catch { /* ignorar preferencia corrupta */ }
}

const etiquetaAlcance = computed(() => {
  if (alcance.value === 'todas') return 'Todas las ciudades';
  if (alcance.value === 'ciudad_especifica' && ciudadSeleccionada.value) return ciudadSeleccionada.value;
  return miCiudad.value ? `Mi ciudad (${miCiudad.value})` : 'Elige una ciudad';
});

function guardarPreferencia() {
  localStorage.setItem(
    CLAVE_LOCALSTORAGE,
    JSON.stringify({ alcance: alcance.value, ciudad: ciudadSeleccionada.value })
  );
}


function elegirAlcance(nuevo) {
  alcance.value = nuevo;
  ciudadSeleccionada.value = null;
  menuAbierto.value = false;
  guardarPreferencia();
}

function elegirCiudadEspecifica(ciudad) {
  if (!ciudad) return;
  alcance.value = 'ciudad_especifica';
  menuAbierto.value = false;
  guardarPreferencia();
}

async function cargarCiudades() {
  const data = await UsersApi.listarCiudades();
  ciudadesDisponibles.value = data.ciudades.map((c) => ({
    city: c.city,
    label: c.country ? `${c.city}, ${c.country}` : c.city
  }));
}

async function cargarPagina() {
  const params = { page: pagina.value, limit: LIMITE_POR_PAGINA, alcance: alcance.value };
  if (alcance.value === 'ciudad_especifica' && ciudadSeleccionada.value) {
    params.ciudad = ciudadSeleccionada.value;
  }
  const data = await PostsApi.listar(params);
  if (data.posts.length < LIMITE_POR_PAGINA) hayMas.value = false;
  posts.value.push(...data.posts);
}

async function reiniciarYCargar() {
  posts.value = [];
  pagina.value = 1;
  hayMas.value = true;
  cargandoInicial.value = true;
  try {
    await cargarPagina();
  } finally {
    cargandoInicial.value = false;
  }
}

async function cargarMas() {
  if (cargandoMas.value || !hayMas.value) return;
  cargandoMas.value = true;
  pagina.value++;
  try {
    await cargarPagina();
  } finally {
    cargandoMas.value = false;
  }
}

function agregarEnVivo(post) {
  // Solo insertamos en caliente si la publicacion nueva encaja con el alcance actual
  if (alcance.value === 'todas') {
    posts.value.unshift(post);
  } else if (alcance.value === 'mi_ciudad' && post.author?.city && post.author.city === miCiudad.value) {
    posts.value.unshift(post);
  } else if (alcance.value === 'ciudad_especifica' && post.author?.city === ciudadSeleccionada.value) {
    posts.value.unshift(post);
  }
}

watch([alcance, ciudadSeleccionada], reiniciarYCargar);

onMounted(async () => {
  await cargarCiudades();
  await reiniciarYCargar();

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) cargarMas();
    },
    { rootMargin: '200px' }
  );
  if (centinela.value) observer.observe(centinela.value);

  const socket = obtenerSocket();
  socket?.on('post:nuevo', agregarEnVivo);
});

onUnmounted(() => {
  observer?.disconnect();
  const socket = obtenerSocket();
  socket?.off('post:nuevo', agregarEnVivo);
});
</script>

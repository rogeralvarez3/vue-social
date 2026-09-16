<template>
  <v-container max-width="1000">
    <h2 class="text-h6 font-weight-bold mb-4">Reportes</h2>

    <v-row class="mb-2">
      <v-col cols="6" sm="3">
        <v-card class="pa-4 text-center" color="primary" variant="tonal">
          <div class="text-h5 font-weight-bold">{{ resumen.publicaciones }}</div>
          <div class="text-caption">Publicaciones (30 días)</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card class="pa-4 text-center" color="secondary" variant="tonal">
          <div class="text-h5 font-weight-bold">{{ resumen.reacciones }}</div>
          <div class="text-caption">Reacciones (30 días)</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card class="pa-4 text-center" color="warning" variant="tonal">
          <div class="text-h5 font-weight-bold">{{ resumen.comentarios }}</div>
          <div class="text-caption">Comentarios (30 días)</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card class="pa-4 text-center" color="success" variant="tonal">
          <div class="text-h5 font-weight-bold">{{ resumen.nuevosAmigos }}</div>
          <div class="text-caption">Nuevos amigos (30 días)</div>
        </v-card>
      </v-col>
    </v-row>

    <v-card class="pa-4">
      <div class="d-flex flex-wrap ga-3 align-center mb-4">
        <v-btn-toggle v-model="recurso" color="primary" density="comfortable" mandatory divided>
          <v-btn value="publicaciones">Publicaciones</v-btn>
          <v-btn value="reacciones">Reacciones</v-btn>
          <v-btn value="comentarios">Comentarios</v-btn>
          <v-btn value="amigos">Amigos</v-btn>
        </v-btn-toggle>

        <v-spacer />

        <v-btn-toggle v-model="periodo" color="secondary" density="comfortable" mandatory divided>
          <v-btn value="dia">Día</v-btn>
          <v-btn value="semana">Semana</v-btn>
          <v-btn value="mes">Mes</v-btn>
        </v-btn-toggle>
      </div>

      <div v-if="cargando" class="text-center py-10">
        <v-progress-circular indeterminate color="primary" />
      </div>
      <Line v-else-if="datosGrafica.labels.length" :data="datosGrafica" :options="opciones" style="max-height: 340px" />
      <p v-else class="text-medium-emphasis text-center py-10">Todavía no hay datos suficientes para graficar.</p>
    </v-card>

    <v-card v-if="recurso === 'reacciones' && porTipo.length" class="pa-4 mt-4">
      <h3 class="text-subtitle-1 font-weight-bold mb-3">Reacciones por tipo</h3>
      <Bar :data="datosPorTipo" :options="opciones" style="max-height: 300px" />
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Line, Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { ReportsApi } from '@/services/resources';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const recurso = ref('publicaciones');
const periodo = ref('dia');
const cargando = ref(false);
const serie = ref([]);
const porTipo = ref([]);
const resumen = ref({ publicaciones: 0, comentarios: 0, reacciones: 0, nuevosAmigos: 0 });

const etiquetasPorRecurso = {
  publicaciones: 'Publicaciones',
  reacciones: 'Reacciones',
  comentarios: 'Comentarios',
  amigos: 'Nuevos amigos'
};

function formatearEtiqueta(iso) {
  const d = new Date(iso);
  if (periodo.value === 'mes') return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

const datosGrafica = computed(() => ({
  labels: serie.value.map((s) => formatearEtiqueta(s.periodo)),
  datasets: [
    {
      label: etiquetasPorRecurso[recurso.value],
      data: serie.value.map((s) => s.total),
      borderColor: '#4f5bd5',
      backgroundColor: 'rgba(79,91,213,0.15)',
      tension: 0.3,
      fill: true
    }
  ]
}));

const coloresPorTipo = { like: '#4f5bd5', love: '#e5484d', haha: '#f5a623', wow: '#f5a623', sad: '#2196f3', angry: '#e5484d' };
const datosPorTipo = computed(() => {
  const agregados = {};
  porTipo.value.forEach((f) => {
    agregados[f.type] = (agregados[f.type] || 0) + Number(f.total);
  });
  const tipos = Object.keys(agregados);
  return {
    labels: tipos,
    datasets: [{ label: 'Reacciones', data: tipos.map((t) => agregados[t]), backgroundColor: tipos.map((t) => coloresPorTipo[t] || '#4f5bd5') }]
  };
});

const opciones = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

async function cargarSerie() {
  cargando.value = true;
  try {
    const data = await ReportsApi.serie(recurso.value, periodo.value);
    serie.value = data.serie;
    porTipo.value = data.porTipo || [];
  } finally {
    cargando.value = false;
  }
}

async function cargarResumen() {
  const data = await ReportsApi.resumen();
  resumen.value = data.resumen;
}

watch([recurso, periodo], cargarSerie);
onMounted(() => {
  cargarSerie();
  cargarResumen();
});
</script>

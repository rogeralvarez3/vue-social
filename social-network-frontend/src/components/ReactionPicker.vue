<template>
  <v-menu location="top" open-on-hover :close-on-content-click="true" transition="scale-transition">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="menuProps"
        variant="text"
        size="small"
        :color="miReaccion ? colorDe(miReaccion) : undefined"
        @click="alternar"
      >
        <span class="mr-1" style="font-size: 16px">{{ miReaccion ? emojiDe(miReaccion) : '👍' }}</span>
        {{ miReaccion ? etiquetaDe(miReaccion) : 'Me gusta' }}
      </v-btn>
    </template>

    <v-sheet rounded="pill" elevation="6" class="d-flex pa-1">
      <v-btn
        v-for="tipo in tipos"
        :key="tipo.valor"
        icon
        variant="text"
        size="small"
        class="reaction-emoji"
        @click="elegir(tipo.valor)"
      >
        <span style="font-size: 20px">{{ tipo.emoji }}</span>
        <v-tooltip activator="parent" location="top">{{ tipo.etiqueta }}</v-tooltip>
      </v-btn>
    </v-sheet>
  </v-menu>
</template>

<script setup>
const props = defineProps({
  miReaccion: { type: String, default: null } // null | like | love | haha | wow | sad | angry
});
const emit = defineEmits(['reaccionar', 'quitar']);

const tipos = [
  { valor: 'like', emoji: '👍', etiqueta: 'Me gusta', color: 'primary' },
  { valor: 'love', emoji: '❤️', etiqueta: 'Me encanta', color: 'error' },
  { valor: 'haha', emoji: '😆', etiqueta: 'Me divierte', color: 'warning' },
  { valor: 'wow', emoji: '😮', etiqueta: 'Me asombra', color: 'warning' },
  { valor: 'sad', emoji: '😢', etiqueta: 'Me entristece', color: 'info' },
  { valor: 'angry', emoji: '😡', etiqueta: 'Me enoja', color: 'error' }
];

function emojiDe(valor) {
  return tipos.find((t) => t.valor === valor)?.emoji || '👍';
}
function etiquetaDe(valor) {
  return tipos.find((t) => t.valor === valor)?.etiqueta || 'Me gusta';
}
function colorDe(valor) {
  return tipos.find((t) => t.valor === valor)?.color || 'primary';
}

function elegir(valor) {
  emit('reaccionar', valor);
}
function alternar() {
  if (props.miReaccion) emit('quitar');
  else emit('reaccionar', 'like');
}
</script>

<style scoped>
.reaction-emoji {
  transition: transform 0.15s ease;
}
.reaction-emoji:hover {
  transform: scale(1.35);
}
</style>

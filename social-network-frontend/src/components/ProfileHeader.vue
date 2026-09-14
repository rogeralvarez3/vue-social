<template>
  <div class="profile-header">
    <div
      class="cover"
      :style="coverStyle"
      @click="triggerCoverInput"
    >
      <v-btn
        icon="mdi-camera"
        size="small"
        variant="flat"
        color="white"
        class="cover-edit-btn"
        @click.stop="triggerCoverInput"
      />
      <input ref="coverInput" type="file" accept="image/*" class="d-none" @change="onCoverChange" />
    </div>

    <div class="avatar-row">
      <v-avatar size="64" class="avatar-medium" @click="$emit('abrir-perfil')">
        <v-img v-if="user?.avatarUrl" :src="user.avatarUrl" cover />
        <span v-else class="text-h6 font-weight-bold">{{ iniciales }}</span>
      </v-avatar>
      <div class="ml-3 flex-grow-1 text-truncate">
        <div class="text-subtitle-1 font-weight-bold text-truncate">{{ user?.fullName || user?.username }}</div>
        <div class="text-caption text-medium-emphasis text-truncate">@{{ user?.username }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  user: { type: Object, default: null }
});
const emit = defineEmits(['abrir-perfil', 'cambiar-portada']);

const coverInput = ref(null);

const iniciales = computed(() => (props.user?.fullName || props.user?.username || '?').trim().charAt(0).toUpperCase());

const coverStyle = computed(() => {
  if (props.user?.coverUrl) {
    return { backgroundImage: `url(${props.user.coverUrl})` };
  }
  return { background: 'linear-gradient(135deg, #4f5bd5 0%, #00c2a8 100%)' };
});

function triggerCoverInput() {
  coverInput.value?.click();
}

function onCoverChange(e) {
  const file = e.target.files?.[0];
  if (file) emit('cambiar-portada', file);
  e.target.value = '';
}
</script>

<style scoped>
.profile-header {
  position: relative;
}
.cover {
  height: 88px;
  background-size: cover;
  background-position: center;
  cursor: pointer;
  position: relative;
}
.cover-edit-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  opacity: 0.85;
}
.avatar-row {
  display: flex;
  align-items: center;
  padding: 0 14px 14px;
  margin-top: -28px;
}
.avatar-medium {
  border: 3px solid rgb(var(--v-theme-surface));
  cursor: pointer;
  background: rgb(var(--v-theme-primary));
  color: white;
}
</style>

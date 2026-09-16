import { defineStore } from 'pinia';
import { NotificationsApi } from '@/services/resources';

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [],
    sinLeer: 0
  }),
  actions: {
    async cargar() {
      const data = await NotificationsApi.listar({ page: 1, limit: 20 });
      this.items = data.notificaciones;
      this.sinLeer = this.items.filter((n) => !n.is_read).length;
    },
    agregarEnVivo(notif) {
      this.items.unshift({
        id: `temp-${Date.now()}`,
        type: notif.type,
        actor_id: notif.actorId,
        entity_id: notif.postId,
        is_read: false,
        created_at: new Date().toISOString(),
        ...notif
      });
      this.sinLeer++;
    },
    async marcarTodasLeidas() {
      await NotificationsApi.marcarTodas();
      this.items.forEach((n) => (n.is_read = true));
      this.sinLeer = 0;
    }
  }
});

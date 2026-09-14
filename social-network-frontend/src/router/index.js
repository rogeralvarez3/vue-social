import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { publico: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiereAuth: true },
    children: [
      { path: '', name: 'feed', component: () => import('@/views/FeedView.vue') },
      { path: 'fotos', name: 'fotos', component: () => import('@/views/PhotosView.vue') },
      { path: 'videos', name: 'videos', component: () => import('@/views/VideosView.vue') },
      { path: 'audios', name: 'audios', component: () => import('@/views/AudiosView.vue') },
      { path: 'amigos', name: 'amigos', component: () => import('@/views/FriendsView.vue') },
      { path: 'grupos', name: 'grupos', component: () => import('@/views/GroupsView.vue') },
      { path: 'documentos', name: 'documentos', component: () => import('@/views/DocumentsView.vue') },
      { path: 'reportes', name: 'reportes', component: () => import('@/views/ReportsView.vue') },
      { path: 'ajustes', name: 'ajustes', component: () => import('@/views/ProfileSettingsView.vue') }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiereAuth && !auth.estaAutenticado) {
    return { name: 'login' };
  }
  if (to.meta.publico && auth.estaAutenticado) {
    return { path: '/' };
  }
  return true;
});

export default router;

/**
 * Funciones de conveniencia sobre `api` (axios) para cada recurso del backend.
 * Todas siguen el patron { action: 'crear' | 'actualizar' | 'borrar' | 'listar', ... }
 * sobre una unica URL por recurso.
 */
import api from './api';

// Nota: cuando "payload" es un FormData (subida de archivos), NO se fija el
// header Content-Type a mano. Axios detecta el FormData automaticamente y
// genera "multipart/form-data; boundary=..." con el boundary correcto; si lo
// sobreescribimos manualmente sin boundary, el backend (Multer) no puede
// parsear el archivo. Para JSON, axios ya pone application/json por defecto.
function llamar(recurso, payload) {
  return api.post(`/${recurso}`, payload).then((r) => r.data);
}

export const AuthApi = {
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  cambiarPassword: (payload) => api.post('/auth/change-password', payload).then((r) => r.data)
};

export const PostsApi = {
  listar: (params) => llamar('posts', { action: 'listar', ...params }),
  crear: (payload) => llamar('posts', payload instanceof FormData ? payload : { action: 'crear', ...payload }),
  actualizar: (payload) => llamar('posts', { action: 'actualizar', ...payload }),
  borrar: (id) => llamar('posts', { action: 'borrar', id })
};

export const CommentsApi = {
  listar: (postId) => llamar('comments', { action: 'listar', postId }),
  crear: (payload) => llamar('comments', { action: 'crear', ...payload }),
  actualizar: (payload) => llamar('comments', { action: 'actualizar', ...payload }),
  borrar: (id) => llamar('comments', { action: 'borrar', id })
};

export const ReactionsApi = {
  listar: (postId) => llamar('reactions', { action: 'listar', postId }),
  crear: (postId, type) => llamar('reactions', { action: 'crear', postId, type }),
  borrar: (postId) => llamar('reactions', { action: 'borrar', postId })
};

export const FriendsApi = {
  listar: (tipo) => llamar('friends', { action: 'listar', tipo }),
  crear: (addresseeId) => llamar('friends', { action: 'crear', addresseeId }),
  actualizar: (id, status) => llamar('friends', { action: 'actualizar', id, status }),
  borrar: (id) => llamar('friends', { action: 'borrar', id })
};

export const UsersApi = {
  listar: (params) => llamar('users', { action: 'listar', ...params }),
  actualizar: (formData) => llamar('users', formData)
};

export const GroupsApi = {
  listar: (params) => llamar('groups', { action: 'listar', ...params }),
  crear: (formData) => llamar('groups', formData),
  unirse: (id) => llamar('groups', { action: 'actualizar', id, unirse: true }),
  salir: (id) => llamar('groups', { action: 'actualizar', id, salir: true }),
  borrar: (id) => llamar('groups', { action: 'borrar', id })
};

export const MediaApi = {
  listar: (params) => llamar('media', { action: 'listar', ...params }),
  crear: (formData) => llamar('media', formData),
  borrar: (id) => llamar('media', { action: 'borrar', id })
};

export const DocumentsApi = {
  listar: (params) => llamar('documents', { action: 'listar', ...params }),
  crear: (formData) => llamar('documents', formData),
  borrar: (id) => llamar('documents', { action: 'borrar', id })
};

export const NotificationsApi = {
  listar: (params) => llamar('notifications', { action: 'listar', ...params }),
  marcarLeida: (id) => llamar('notifications', { action: 'actualizar', id }),
  marcarTodas: () => llamar('notifications', { action: 'actualizar', marcarTodas: true })
};

export const ReportsApi = {
  resumen: () => llamar('reports', { action: 'resumen' }),
  serie: (recurso, periodo) => llamar('reports', { action: 'listar', recurso, periodo })
};

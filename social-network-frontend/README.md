# Red Social - Frontend (Vue 3 + Vuetify 3)

SPA moderna que consume el backend de `social-network` (Express + PostgreSQL +
Socket.io). Construida con Vue 3, Vuetify 3, Pinia, Vue Router y Vite.

## Secciones incluidas

- **Publicaciones** (`/`): feed con texto, **foto, vídeo o audio** (un
  adjunto por publicación), reacciones estilo Facebook (👍 ❤️ 😆 😮 😢 😡)
  y comentarios en **árbol** (respuestas anidadas ilimitadas), todo en
  tiempo real vía Socket.io. Cualquier foto/vídeo/audio publicado aquí
  aparece automáticamente también en su sección correspondiente del menú.
- **Fotos** (`/fotos`), **Vídeos** (`/videos`) y **Audios** (`/audios`):
  galería personal con subida directa; también se llenan solas con lo que
  subas desde Publicaciones.
- **Amigos** (`/amigos`): mis amigos, solicitudes recibidas/enviadas, buscador
  de personas.
- **Grupos** (`/grupos`): crear, unirse/salir, listado con portada.
- **Documentos** (`/documentos`): subir y descargar archivos (PDF, Word,
  Excel, PowerPoint, ZIP, etc.).
- **Reportes** (`/reportes`): tarjetas resumen (últimos 30 días) + gráficas de
  **reacciones, comentarios, publicaciones y amigos por día, semana o mes**,
  con desglose de reacciones por tipo.
- **Configuración de cuenta** (`/ajustes`, accesible desde el menú del
  avatar): editar perfil (nombre, biografía, foto de perfil y portada),
  cambiar contraseña, preferencias de notificaciones y cerrar sesión.

## Detalles de diseño que pediste

- La **foto de perfil** se muestra en tamaño mediano en la **parte superior
  izquierda** (cabecera del menú lateral: componente `ProfileHeader.vue`),
  con opción de poner/cambiar una **imagen de fondo** (portada) haciendo clic
  sobre ella.
- Los **comentarios son un árbol real**: cada comentario puede tener
  respuestas, y cada respuesta puede tener las suyas (componente recursivo
  `CommentNode.vue`), sin límite de profundidad.
- **Sorpresas añadidas** (no las pediste explícitamente, pero encajan con una
  red social moderna):
  - Reacciones múltiples tipo Facebook en vez de un simple "like".
  - Modo claro/oscuro con un interruptor en la barra superior.
  - Grupos con portada y membresía.
  - Documentos compartidos con iconos según tipo de archivo.
  - Notificaciones en tiempo real con campanita y contador.
  - Reportes con gráficas interactivas (Chart.js) y desglose por tipo de
    reacción.

## Instalación

1. Asegúrate de tener el backend (`social-network`) corriendo en
   `https://localhost:4000` (ver su propio README: `npm run dev` allí).

2. Instala dependencias:
   ```bash
   npm install
   ```

3. (Opcional) copia `.env.example` a `.env` si tu backend corre en otra URL:
   ```bash
   cp .env.example .env
   ```

4. Arranca el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Se abre en `http://localhost:5173`. Vite hace de proxy hacia el backend
   HTTPS para `/api`, `/uploads` y `/socket.io`, así que no hay problemas de
   CORS ni necesitas exponer el certificado autofirmado al navegador dos
   veces (solo lo verás una vez si accedes directo al backend).

5. Para producción:
   ```bash
   npm run build
   ```
   Esto genera `dist/`, listo para servirse desde cualquier servidor estático
   (o desde el propio backend Express, copiándolo a su carpeta `public/`).

## Estructura

```
src/
├── main.js                 # Arranque de Vue + Vuetify + Pinia + Router
├── App.vue                 # <v-app> raíz
├── plugins/vuetify.js       # Tema propio (claro/oscuro)
├── router/index.js          # Rutas + guardas de autenticación
├── stores/                  # Pinia: auth.js, notifications.js
├── services/
│   ├── api.js                # axios + refresh automático de token
│   ├── socket.js              # Cliente Socket.io autenticado
│   └── resources.js           # Wrapper por recurso (action-based)
├── layouts/MainLayout.vue    # Navegación lateral + barra superior
├── components/                # ProfileHeader, PostCard, CommentTree, etc.
└── views/                     # Una vista por sección del menú
```

## Notas

- El token de acceso vive en `sessionStorage` (se pierde al cerrar la
  pestaña, por diseño); el refresh token vive en la cookie httpOnly que ya
  gestiona el backend.
- Todas las llamadas a la API siguen el patrón `{ action: 'crear' |
  'actualizar' | 'borrar' | 'listar', ... }` que ya usa el backend — revisa
  `src/services/resources.js` para ver el mapeo completo.

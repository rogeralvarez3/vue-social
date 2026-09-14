# Red Social - Backend (Express + PostgreSQL + Socket.io)

Backend completo tipo "Facebook simplificado", con autenticacion segura por
tokens JWT, tiempo real con Socket.io, base de datos PostgreSQL, y un patron
de **acción única por recurso** en vez de CRUD tradicional.

## Filosofía de rutas (importante)

En lugar de tener un endpoint distinto por operación (POST /posts, PUT
/posts/:id, DELETE /posts/:id, GET /posts), cada recurso tiene **una sola
URL** que recibe un parámetro `action` en el body (o query) y decide qué
hacer:

```
POST /api/posts   { "action": "crear",      "content": "Hola mundo" }
POST /api/posts   { "action": "actualizar", "id": "...", "content": "editado" }
POST /api/posts   { "action": "borrar",     "id": "..." }
POST /api/posts   { "action": "listar",     "page": 1, "limit": 10 }
```

Esto aplica igual para: `/api/posts`, `/api/comments`, `/api/likes`,
`/api/friends`, `/api/messages`, `/api/notifications` y `/api/users`.

La ruta (`routes/*.routes.js`) es solo un "despachador" delgado; toda la
lógica de negocio vive en `handlers/*.handler.js`, en una única función por
recurso que hace el `switch(action)`.

La única excepción intencional es **`/api/auth`** (registro, login, refresh,
logout): por ser el flujo de seguridad más sensible, se mantiene con rutas
explícitas y dedicadas en vez de un parámetro `action`, para que la lógica de
autenticación sea lo más clara y auditable posible.

## Estructura de carpetas

```
social-network/
├── server.js                  # Arranca HTTP + Socket.io
├── package.json
├── .env.example                # Copiar a .env y completar
├── src/
│   ├── app.js                  # Configuración de Express
│   ├── config/
│   │   ├── db.js                # Pool de PostgreSQL
│   │   └── socket.js            # Socket.io + autenticación + helpers de emisión
│   ├── middleware/
│   │   ├── auth.js              # Verificación de JWT (authenticate / optionalAuth)
│   │   ├── upload.js            # Multer (avatares, portadas, imágenes de posts)
│   │   └── errorHandler.js
│   ├── utils/
│   │   └── tokens.js            # Firmar/verificar access y refresh tokens
│   ├── routes/                  # Un archivo por recurso (rutas "delgadas")
│   ├── handlers/                # Toda la lógica: crear/actualizar/borrar/listar
│   └── db/
│       ├── schema.sql           # Esquema completo de la base de datos
│       └── init.js              # Script para aplicar el schema
├── uploads/
│   ├── avatars/                 # Fotos de perfil y portada
│   └── posts/                   # Imágenes de publicaciones
└── public/                      # Frontend (HTML/CSS/JS puro)
    ├── index.html                # Login / registro
    ├── feed.html                 # Feed principal
    ├── css/style.css
    └── js/ (api.js, auth.js, feed.js, socket-client.js)
```

## Adjuntos en publicaciones (foto, vídeo o audio)

Cada publicación admite **un adjunto opcional**: foto, vídeo o audio, todos a
través del mismo campo `media` en el formulario (`POST /api/posts` con
`action: 'crear'`). El servidor detecta automáticamente el tipo por su
`mimetype` y lo procesa según corresponda (ver la sección de compresión más
abajo).

Además, **cada adjunto subido en una publicación se replica automáticamente
en la tabla `media`**, enlazado a esa publicación (`post_id`). Por eso, una
foto, vídeo o audio publicado en el muro aparece también, sin pasos extra,
en las secciones **Fotos**, **Vídeos** y **Audios** del menú del frontend
(que consultan `GET/POST /api/media` filtrando por `type`).

## Compresión automática de imágenes y vídeos

Para que la subida de archivos nunca sea un problema de tamaño, el servidor
comprime todo automáticamente antes de guardarlo (ver
`src/utils/mediaProcessing.js`):

- **Imágenes** (avatar, portada, fotos de publicaciones, portada de grupo,
  galería de fotos): se re-escalan para que quepan dentro de **1920x1080**
  (nunca se agrandan si ya son más pequeñas) y se recomprimen en **JPEG
  calidad 82**. Los GIF animados conservan su animación.
- **Vídeos** (galería de vídeos): se transcodifican siempre a **MP4**
  (H.264 + AAC), con **CRF 28** y `-preset veryfast` — un nivel de
  compresión equivalente al que usan redes sociales como Facebook para
  vídeo subido por usuarios: se nota poca pérdida de calidad a simple vista,
  pero el archivo pesa una fracción del original. También se limitan a
  1920x1080 y se agrega `faststart`, para que empiecen a reproducirse en
  streaming sin tener que descargarse por completo.
- **Documentos** no se comprimen (para no dañar su integridad), pero el
  límite de tamaño se dejó amplio (50 MB por defecto).

El flujo es: Multer recibe el archivo original en `uploads/tmp/` con un
límite generoso (`MAX_IMAGE_UPLOAD_MB=25`, `MAX_VIDEO_UPLOAD_MB=500` por
defecto, configurables en `.env`) para que la subida casi nunca falle por
tamaño; luego `sharp` (imágenes) o `ffmpeg` (vídeos, vía
`@ffmpeg-installer/ffmpeg`, sin necesidad de instalar ffmpeg aparte en el
sistema) comprimen el archivo y lo mueven ya liviano a su carpeta final,
borrando el temporal.

Como transcodificar un vídeo puede tardar, el servidor HTTPS se configuró
con timeouts largos (15 minutos) para que esa espera no corte la conexión.

## Instalación

1. Requisitos: Node.js 18+, PostgreSQL 13+, OpenSSL (viene preinstalado en
   Linux/macOS; en Windows se puede usar Git Bash o WSL).

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Crear la base de datos en PostgreSQL:
   ```bash
   createdb social_network
   ```

4. Copiar variables de entorno y completarlas:
   ```bash
   cp .env.example .env
   ```
   Edita `.env` con tus credenciales de PostgreSQL y genera secretos JWT
   largos y aleatorios (por ejemplo con `openssl rand -hex 64`).

5. Aplicar el esquema de la base de datos:
   ```bash
   npm run db:init
   ```

6. Generar el certificado TLS local de prueba (el proyecto ya incluye uno en
   `certs/`, pero es recomendable generar el tuyo propio):
   ```bash
   bash scripts/generar-certificado.sh
   ```
   Esto crea `certs/key.pem` (clave privada) y `certs/cert.pem` (certificado
   autofirmado, válido para `localhost` / `127.0.0.1`).

7. Arrancar el servidor:
   ```bash
   npm run dev     # con recarga automática (nodemon)
   # o
   npm start
   ```
   El servidor **solo arranca en HTTPS**; si no encuentra los certificados
   se detiene con un mensaje indicando cómo generarlos.

8. Abrir en el navegador: `https://localhost:4000`

   Al ser un certificado autofirmado, el navegador mostrará una advertencia
   de seguridad ("La conexión no es privada" / "NET::ERR_CERT_AUTHORITY_INVALID").
   Es completamente normal en desarrollo local: haz clic en "Avanzado" →
   "Continuar a localhost". Para un entorno real (producción) se debe
   sustituir por un certificado emitido por una autoridad confiable, por
   ejemplo con [Let's Encrypt](https://letsencrypt.org/).

### Notas sobre HTTPS

- Cualquier petición a `http://localhost:4080` se redirige automáticamente
  con un 301 a `https://localhost:4000` (protege por si algo intenta
  conectarse sin cifrar).
- La cookie del refresh token se marca `secure: true` siempre, por lo que
  **solo viaja por HTTPS** (nunca en texto plano).
- Socket.io corre sobre el mismo servidor HTTPS (`wss://` en vez de `ws://`).
- Si pruebas la API con `curl` o Postman contra el certificado autofirmado,
  necesitarás desactivar la verificación estricta del certificado
  (`curl -k https://localhost:4000/api/health`), solo para pruebas locales.

## Seguridad implementada

- Contraseñas con **bcrypt** (12 rondas).
- **Access token JWT de corta duración** (15 min) en el header `Authorization`.
- **Refresh token** de larga duración (7 días) en **cookie httpOnly + secure**
  (nunca accesible desde JavaScript del navegador), guardado **hasheado**
  (SHA-256) en la base de datos, con **rotación**: cada vez que se usa se
  invalida y se emite uno nuevo, y si se detecta reutilización de un token ya
  revocado se cierran todas las sesiones del usuario por precaución.
- **Rate limiting** general sobre `/api` y más estricto sobre `/api/auth/login`.
- **Helmet** para cabeceras HTTP seguras y **CORS** restringido al origen del
  cliente.
- Todas las consultas SQL usan **parámetros** (`$1, $2...`), nunca
  concatenación de strings, para evitar inyección SQL.
- Validación de tipo MIME y tamaño máximo en la subida de imágenes (Multer).
- Verificación de propiedad (ownership) antes de editar/borrar cualquier
  recurso (un usuario no puede editar publicaciones, comentarios o mensajes
  ajenos).
- Borrado lógico (`deleted_at`) en usuarios, publicaciones y comentarios para
  conservar el historial/integridad referencial.

## Tiempo real (Socket.io)

La conexión de socket exige un access token válido (`socket.handshake.auth.token`).
Cada usuario se une automáticamente a una sala privada `user:<id>`.

Eventos emitidos:
- `post:nuevo`, `post:actualizado`, `post:borrado`
- `comentario:nuevo`, `comentario:actualizado`, `comentario:borrado`
- `like:nuevo`, `like:borrado`
- `amistad:solicitud`, `amistad:aceptada`
- `mensaje:nuevo`, `mensaje:enviado`, `mensaje:leido`
- `notificacion:nueva`

## Notas

- El frontend incluido es funcional pero deliberadamente sencillo (vanilla
  JS), pensado como referencia de cómo consumir la API y los sockets; puedes
  reemplazarlo por React/Vue si lo prefieres, ya que el backend es
  independiente del cliente.
- Las imágenes se guardan en disco bajo `/uploads` y se sirven como archivos
  estáticos en `http://localhost:4000/uploads/...`. Para producción real se
  recomendaría mover esto a un almacenamiento como S3.

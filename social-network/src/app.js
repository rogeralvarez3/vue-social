/**
 * Configuracion principal de la app Express.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const postsRoutes = require('./routes/posts.routes');
const commentsRoutes = require('./routes/comments.routes');
const likesRoutes = require('./routes/likes.routes');
const reactionsRoutes = require('./routes/reactions.routes');
const friendsRoutes = require('./routes/friends.routes');
const messagesRoutes = require('./routes/messages.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const groupsRoutes = require('./routes/groups.routes');
const mediaRoutes = require('./routes/media.routes');
const documentsRoutes = require('./routes/documents.routes');
const reportsRoutes = require('./routes/reports.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // permite servir imagenes al frontend
}));
app.use(cors({
  origin: process.env.CLIENT_URL || true,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Limite general anti fuerza-bruta / abuso sobre toda la API
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

// Archivos estaticos: imagenes subidas por los usuarios
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Frontend estatico (public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------
// RUTAS DE LA API
// ---------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/reactions', reactionsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, status: 'activo' }));

app.use((req, res) => res.status(404).json({ ok: false, error: 'Ruta no encontrada' }));
app.use(errorHandler);

module.exports = app;

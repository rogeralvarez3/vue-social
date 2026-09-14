/**
 * Middleware de subida de archivos.
 *
 * Estrategia en dos pasos para imagenes y videos:
 *   1) Multer guarda el archivo original en uploads/tmp (limites generosos,
 *      para que la subida nunca falle por tamaño antes de comprimir).
 *   2) Un middleware posterior (procesarImagenSubida / procesarMediaSubida /
 *      procesarImagenesPerfil) comprime ese archivo con sharp/ffmpeg y lo
 *      mueve ya liviano a su carpeta definitiva, borrando el temporal.
 *
 * Los documentos NO se comprimen (perderian integridad), asi que van
 * directo a su carpeta final con un limite de tamaño amplio.
 */
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { comprimirImagen, comprimirVideo, moverAudio } = require('../utils/mediaProcessing');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo'];
const ALLOWED_AUDIO_MIME = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg',
  'audio/webm', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/flac'
];
const ALLOWED_DOCUMENT_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip'
];

// Limites sobre el archivo ORIGINAL (antes de comprimir). Se dejan holgados
// a proposito: la compresion posterior es la que garantiza que lo que queda
// guardado en el servidor sea liviano, no el rechazo temprano de la subida.
const MAX_IMAGE_UPLOAD_MB = Number(process.env.MAX_IMAGE_UPLOAD_MB || 25);
const MAX_VIDEO_UPLOAD_MB = Number(process.env.MAX_VIDEO_UPLOAD_MB || 500);
const MAX_DOCUMENT_SIZE_MB = Number(process.env.MAX_DOCUMENT_SIZE_MB || 50);

/**
 * Determina si un archivo es foto, video o audio, priorizando el campo
 * "type" que mande el formulario y usando el mimetype como respaldo/verificacion.
 */
function detectarTipoArchivo(mimetype, tipoSolicitado) {
  if (['photo', 'video', 'audio'].includes(tipoSolicitado)) return tipoSolicitado;
  if (ALLOWED_VIDEO_MIME.includes(mimetype)) return 'video';
  if (ALLOWED_AUDIO_MIME.includes(mimetype)) return 'audio';
  return 'photo';
}


function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');
const TMP_DIR = path.join(UPLOADS_ROOT, 'tmp');
ensureDir(TMP_DIR);

function carpetaDestino(subfolder) {
  const dest = path.join(UPLOADS_ROOT, subfolder);
  ensureDir(dest);
  return dest;
}

function storageEnCarpeta(subfolder) {
  const dest = carpetaDestino(subfolder);
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}_${crypto.randomBytes(16).toString('hex')}${ext}`);
    }
  });
}

// Almacenamiento temporal: aqui caen los archivos que luego se comprimen
function storageTemporal() {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}_${crypto.randomBytes(16).toString('hex')}${ext}`);
    }
  });
}

function filtroImagen(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error('Tipo de archivo no permitido. Solo se aceptan JPG, PNG, WEBP o GIF.'));
  }
  cb(null, true);
}

function filtroMedia(req, file, cb) {
  if (![...ALLOWED_MIME, ...ALLOWED_VIDEO_MIME, ...ALLOWED_AUDIO_MIME].includes(file.mimetype)) {
    return cb(new Error('Formato no soportado. Sube una imagen (JPG/PNG/WEBP/GIF), un video (MP4/WEBM/MOV/MKV/AVI) o un audio (MP3/WAV/OGG/AAC/M4A/FLAC).'));
  }
  cb(null, true);
}

function filtroDocumento(req, file, cb) {
  if (!ALLOWED_DOCUMENT_MIME.includes(file.mimetype)) {
    return cb(new Error('Tipo de documento no permitido.'));
  }
  cb(null, true);
}

// ---------------------------------------------------------
// Uploaders (paso 1: recibir el archivo en crudo)
// ---------------------------------------------------------
const uploadAvatar = multer({
  storage: storageTemporal(),
  fileFilter: filtroImagen,
  limits: { fileSize: MAX_IMAGE_UPLOAD_MB * 1024 * 1024 }
});

const uploadPostMedia = multer({
  storage: storageTemporal(),
  fileFilter: filtroMedia,
  limits: { fileSize: MAX_VIDEO_UPLOAD_MB * 1024 * 1024 } // el limite mas amplio, por si adjuntan video
});

const uploadProfileImages = multer({
  storage: storageTemporal(),
  fileFilter: filtroImagen,
  limits: { fileSize: MAX_IMAGE_UPLOAD_MB * 1024 * 1024 }
}).fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover', maxCount: 1 }
]);

const uploadGroupCover = multer({
  storage: storageTemporal(),
  fileFilter: filtroImagen,
  limits: { fileSize: MAX_IMAGE_UPLOAD_MB * 1024 * 1024 }
});

const uploadMedia = multer({
  storage: storageTemporal(),
  fileFilter: filtroMedia,
  limits: { fileSize: MAX_VIDEO_UPLOAD_MB * 1024 * 1024 }
});

const uploadDocument = multer({
  storage: storageEnCarpeta('documents'),
  fileFilter: filtroDocumento,
  limits: { fileSize: MAX_DOCUMENT_SIZE_MB * 1024 * 1024 }
});

// ---------------------------------------------------------
// Post-procesamiento (paso 2: comprimir y mover a destino final)
// ---------------------------------------------------------

/**
 * Para rutas con un unico campo de imagen (posts, avatares sueltos, portada
 * de grupo). Si no vino archivo, simplemente continua.
 */
function procesarImagenSubida(subfolder) {
  return async (req, res, next) => {
    try {
      if (!req.file) return next();
      const destDir = carpetaDestino(subfolder);
      const filename = await comprimirImagen(req.file.path, destDir, req.file.mimetype);
      req.file.filename = filename;
      req.file.destination = destDir;
      req.file.path = path.join(destDir, filename);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Para el formulario de perfil, que puede traer "avatar" y/o "cover" a la vez.
 */
function procesarImagenesPerfil(subfolder) {
  return async (req, res, next) => {
    try {
      const destDir = carpetaDestino(subfolder);
      if (req.files?.avatar?.[0]) {
        const f = req.files.avatar[0];
        f.filename = await comprimirImagen(f.path, destDir, f.mimetype);
      }
      if (req.files?.cover?.[0]) {
        const f = req.files.cover[0];
        f.filename = await comprimirImagen(f.path, destDir, f.mimetype);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Para la galeria de fotos/videos/audios (y para el archivo adjunto de una
 * publicacion, que comparte esta misma logica): decide comprimir como
 * imagen, transcodificar como video, o simplemente mover el audio, segun
 * el tipo detectado (campo "type" del formulario o el mimetype real).
 * Deja el tipo final en req.file.mediaType para que el handler lo use.
 */
function procesarMediaSubida(subfolder) {
  return async (req, res, next) => {
    try {
      if (!req.file) return next();
      const destDir = carpetaDestino(subfolder);
      const tipo = detectarTipoArchivo(req.file.mimetype, req.body.type);

      let filename;
      if (tipo === 'video') {
        filename = await comprimirVideo(req.file.path, destDir);
      } else if (tipo === 'audio') {
        filename = moverAudio(req.file.path, destDir, req.file.originalname);
      } else {
        filename = await comprimirImagen(req.file.path, destDir, req.file.mimetype);
      }

      req.file.filename = filename;
      req.file.mediaType = tipo;
      req.file.destination = destDir;
      req.file.path = path.join(destDir, filename);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  uploadAvatar,
  uploadPostMedia,
  uploadProfileImages,
  uploadGroupCover,
  uploadMedia,
  uploadDocument,
  procesarImagenSubida,
  procesarImagenesPerfil,
  procesarMediaSubida
};

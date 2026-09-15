/**
 * Procesamiento de medios subidos por los usuarios:
 *
 *  - IMAGENES: se re-escalan (sin recortar) para que quepan dentro de
 *    1920x1080 (nunca se agrandan si ya son mas pequeñas) y se recomprimen
 *    en JPEG con calidad 82 (equivalente a lo que hace Facebook/Instagram al
 *    subir fotos: mantiene buena calidad visual pero reduce mucho el peso).
 *    Los GIF animados se re-escalan preservando la animacion.
 *
 *  - VIDEOS: se transcodifican siempre a MP4 (H.264 + AAC), con un CRF 28
 *    (factor de calidad constante) y un preset rapido. CRF 28 en x264 es un
 *    nivel de compresion comparable al que usan las redes sociales para
 *    video subido por usuarios: se nota poca perdida de calidad a simple
 *    vista pero el archivo pesa una fraccion del original. Tambien se limita
 *    la resolucion a un maximo de 1920x1080 y se agrega "faststart" para que
 *    el video pueda reproducirse en streaming (empieza a verse sin descargar
 *    el archivo completo), igual que hacen Facebook/YouTube/Instagram.
 *
 * Ambas funciones reciben el archivo temporal que dejo Multer y devuelven el
 * nombre final del archivo ya comprimido, guardado en la carpeta destino.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const JPEG_QUALITY = 82;
const VIDEO_CRF = 28; // ~ nivel de compresion tipo Facebook (18=casi sin perdida, 28=alta compresion)

function nombreUnico(extension) {
  return `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${extension}`;
}

function borrarSilencioso(rutaArchivo) {
  fs.unlink(rutaArchivo, () => {});
}

/**
 * Comprime y redimensiona una imagen. Devuelve el nombre de archivo final
 * (ya guardado dentro de destDir).
 */
async function comprimirImagen(rutaTemporal, destDir, mimetype) {
  const esGif = mimetype === 'image/gif';
  const filename = nombreUnico(esGif ? 'gif' : 'jpg');
  const destPath = path.join(destDir, filename);

  let pipeline = sharp(rutaTemporal, { animated: esGif })
    .rotate() // corrige la orientacion segun los metadatos EXIF de la foto original
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true // nunca agranda imagenes que ya son mas pequeñas
    });

  pipeline = esGif
    ? pipeline.gif()
    : pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });

  await pipeline.toFile(destPath);
  borrarSilencioso(rutaTemporal);
  return filename;
}

/**
 * Transcodifica un video a MP4 (H.264/AAC) con compresion tipo Facebook.
 * Devuelve una promesa que resuelve con el nombre de archivo final.
 */
function comprimirVideo(rutaTemporal, destDir) {
  return new Promise((resolve, reject) => {
    const filename = nombreUnico('mp4');
    const destPath = path.join(destDir, filename);

    ffmpeg(rutaTemporal)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('128k')
      .outputOptions([
        `-crf ${VIDEO_CRF}`,
        '-preset veryfast',
        '-movflags +faststart',
        // Reduce la resolucion solo si excede 1920x1080, manteniendo la proporcion
        `-vf scale='min(${MAX_WIDTH},iw)':'min(${MAX_HEIGHT},ih)':force_original_aspect_ratio=decrease`,
        '-pix_fmt yuv420p'
      ])
      .format('mp4')
      .on('end', () => {
        borrarSilencioso(rutaTemporal);
        resolve(filename);
      })
      .on('error', (err) => {
        borrarSilencioso(rutaTemporal);
        reject(new Error(`No se pudo procesar el video: ${err.message}`));
      })
      .save(destPath);
  });
}

/**
 * Mueve un audio a su carpeta final sin recomprimir (no se pidio transcodificar
 * audio, solo permitir adjuntarlo). Conserva la extension original.
 */
function moverAudio(rutaTemporal, destDir, nombreOriginal) {
  const ext = path.extname(nombreOriginal || '').toLowerCase() || '.mp3';
  const filename = nombreUnico(ext.replace('.', '') || 'mp3');
  const destPath = path.join(destDir, filename);
  fs.renameSync(rutaTemporal, destPath);
  return filename;
}

module.exports = { comprimirImagen, comprimirVideo, moverAudio, MAX_WIDTH, MAX_HEIGHT, JPEG_QUALITY, VIDEO_CRF };

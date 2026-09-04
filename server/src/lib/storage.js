'use strict';
/**
 * Couche de stockage des fichiers (médias).
 * -------------------------------------------------------------------------
 * La base de données ne contient JAMAIS le fichier : seulement une clé
 * (`storage_key`) + des métadonnées. On peut donc changer de stockage
 * (disque local, volume persistant, S3/R2/Spaces…) sans casser les
 * références du frontend, qui pointent toujours vers /media/:id.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { HttpError } = require('./util');

const IMAGE_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};
const VIDEO_MIME = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
};
const FILE_MIME = {
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'text/plain': '.txt',
};

function kindForMime(mime) {
  if (IMAGE_MIME[mime]) return 'image';
  if (VIDEO_MIME[mime]) return 'video';
  if (FILE_MIME[mime]) return 'file';
  return null;
}

function extForMime(mime, originalName) {
  const known = IMAGE_MIME[mime] || VIDEO_MIME[mime] || FILE_MIME[mime];
  if (known) return known;
  const ext = path.extname(originalName || '').toLowerCase();
  return /^\.[a-z0-9]{2,5}$/.test(ext) ? ext : '.bin';
}

function maxBytesForMime(mime) {
  const kind = kindForMime(mime);
  const mb = kind === 'video' ? config.storage.maxVideoMb
    : kind === 'image' ? config.storage.maxImageMb
      : config.storage.maxFileMb;
  return mb * 1024 * 1024;
}

/** Nom de fichier sûr : aléatoire + extension contrôlée (aucun nom fourni par l'utilisateur). */
function safeKey(mime, originalName) {
  return `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${extForMime(mime, originalName)}`;
}

/* ------------------------------ Drivers ------------------------------ */

const localDriver = {
  name: 'local',
  async save(buffer, key) {
    const dest = path.join(config.storage.localDir, key);
    await fs.promises.writeFile(dest, buffer);
    return { storage: 'local', storage_key: key };
  },
  async remove(key) {
    if (!key) return;
    try { await fs.promises.unlink(path.join(config.storage.localDir, key)); } catch (_) { /* déjà absent */ }
  },
  /** Chemin absolu à streamer (le serveur sert le fichier via /media/:id). */
  localPath(key) {
    return path.join(config.storage.localDir, key);
  },
  publicUrl() {
    return null; // servi par le backend
  },
};

/**
 * Driver S3 / R2 / Spaces — activé en définissant STORAGE_DRIVER=s3 et les
 * clés associées. Il nécessite le paquet optionnel @aws-sdk/client-s3.
 * Rien n'est simulé : si le SDK ou la configuration manque, on le dit.
 */
const s3Driver = {
  name: 's3',
  _client: null,
  client() {
    if (this._client) return this._client;
    let S3;
    try {
      S3 = require('@aws-sdk/client-s3');
    } catch (_) {
      throw new HttpError(500, "Stockage S3 demandé mais le paquet @aws-sdk/client-s3 n'est pas installé (npm i @aws-sdk/client-s3).");
    }
    const { bucket, region, endpoint, accessKeyId, secretAccessKey } = config.storage.s3;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new HttpError(500, 'Configuration S3 incomplète (S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY).');
    }
    this._S3 = S3;
    this._client = new S3.S3Client({
      region: region || 'auto',
      endpoint: endpoint || undefined,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this._client;
  },
  async save(buffer, key, mime) {
    const client = this.client();
    await client.send(new this._S3.PutObjectCommand({
      Bucket: config.storage.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
    }));
    return { storage: 's3', storage_key: key };
  },
  async remove(key) {
    if (!key) return;
    const client = this.client();
    await client.send(new this._S3.DeleteObjectCommand({ Bucket: config.storage.s3.bucket, Key: key }));
  },
  localPath() { return null; },
  publicUrl(key) {
    const base = config.storage.s3.publicBaseUrl;
    return base ? `${base.replace(/\/$/, '')}/${key}` : null;
  },
};

const drivers = { local: localDriver, s3: s3Driver };

function driver() {
  return drivers[config.storage.driver] || localDriver;
}

module.exports = { driver, kindForMime, extForMime, maxBytesForMime, safeKey, IMAGE_MIME, VIDEO_MIME, FILE_MIME };

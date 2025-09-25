// src/services/fileService.ts
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import db from '../db';

const unlink = promisify(fs.unlink);

// Directorio base seguro para uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve('uploads');

class FileService {
  static async saveProfilePicture(
    userId: string,
    file: any // Express.Multer.File
  ): Promise<string> {
    const user = await db('users')
      .select('picture_path')
      .where({ id: userId })
      .first();
    if (!user) throw new Error('User not found');

    // Borrar foto anterior si existe
    if (user.picture_path) {
      try { await unlink(path.resolve(user.picture_path)); } catch { /* ignore */ }
    }

    // Guardar archivo en carpeta segura
    const safeFileName = path.basename(file.path);
    const safePath = path.resolve(UPLOADS_DIR, safeFileName);

    await db('users')
      .update({ picture_path: safePath })
      .where({ id: userId });

    return `${process.env.API_BASE_URL}/uploads/${safeFileName}`;
  }

  static async getProfilePicture(userId: string) {
    const user = await db('users')
      .select('picture_path')
      .where({ id: userId })
      .first();
    if (!user || !user.picture_path) throw new Error('No profile picture');

    // Validar ruta dentro de directorio permitido
    const safeBase = path.resolve(UPLOADS_DIR);
    const candidatePath = path.resolve(user.picture_path);
    if (!candidatePath.startsWith(safeBase + path.sep) && candidatePath !== safeBase) {
      throw new Error('Invalid file path');
    }

    const stream = fs.createReadStream(candidatePath);
    const ext = path.extname(candidatePath).toLowerCase();
    const contentType =
      ext === '.png'  ? 'image/png'  :
      ext === '.jpg'  ? 'image/jpeg' :
      ext === '.jpeg' ? 'image/jpeg' :
      'application/octet-stream';

    return { stream, contentType };
  }

  static async deleteProfilePicture(userId: string) {
    const user = await db('users')
      .select('picture_path')
      .where({ id: userId })
      .first();
    if (!user || !user.picture_path) throw new Error('No profile picture');

    const safePath = path.resolve(user.picture_path);
    try { await unlink(safePath); } catch { /* ignore */ }

    await db('users')
      .update({ picture_path: null })
      .where({ id: userId });
  }
}

export default FileService;
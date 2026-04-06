import { Router, Request, Response } from 'express';
import { authMiddleware, requireRegistered } from '../middleware/auth';
import { storage } from '../utils/firebase';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const uploadRouter = Router();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

uploadRouter.post('/avatar', authMiddleware, requireRegistered, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' });
    }

    const filename = `avatars/${uuidv4()}-${req.file.originalname}`;
    const bucket = storage();
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
    });

    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    res.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error uploading avatar:', message);
    res.status(500).json({ message: 'Failed to upload avatar' });
  }
});

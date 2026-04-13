import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// In-memory storage for demo purposes (since Vercel /tmp is ephemeral anyway)
// In a real production app, you'd use S3 or similar, but for this shortcut flow, 
// a memory map in the Cloud Run container works perfectly.
interface TempFile {
  buffer: Buffer;
  name: string;
  mimetype: string;
  expires: number;
}
const fileStore = new Map<string, TempFile>();

// Cleanup expired files every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, file] of fileStore.entries()) {
    if (now > file.expires) {
      fileStore.delete(id);
    }
  }
}, 60000);

const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

async function startServer() {
  // API Routes
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const id = uuidv4();
    fileStore.set(id, {
      buffer: req.file.buffer,
      name: req.file.originalname,
      mimetype: req.file.mimetype,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
    });

    res.json({ 
      id, 
      url: `/import?id=${id}`,
      expiresIn: '10 minutes'
    });
  });

  app.get('/api/file', (req, res) => {
    const id = req.query.id as string;
    const file = fileStore.get(id);

    if (!file) {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.send(file.buffer);
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

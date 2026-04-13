import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Load Firebase config manually
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
    // Try the .appspot.com suffix which is the most common default
    storageBucket: `${firebaseConfig.projectId}.appspot.com`
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filename = (req.headers['x-filename'] as string) || 'document.pdf';
    const contentType = req.headers['content-type'] || 'application/pdf';
    
    const fileId = uuidv4();
    const storagePath = `imports/${fileId}/${filename}`;
    const file = bucket.file(storagePath);

    // Stream the request body to Firebase Storage using Admin SDK
    await new Promise((resolve, reject) => {
      const stream = file.createWriteStream({
        metadata: {
          contentType: contentType,
        },
        resumable: false // Better for small files in serverless
      });
      req.pipe(stream)
        .on('error', reject)
        .on('finish', resolve);
    });

    // Store metadata in Firestore using Admin SDK
    await db.collection('imports').doc(fileId).set({
      fileName: filename,
      storagePath: storagePath,
      createdAt: new Date().toISOString()
    });

    const baseUrl = 'https://wide-pdf.vercel.app';
    
    res.json({ 
      id: fileId, 
      url: `${baseUrl}/import?id=${fileId}`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error instanceof Error ? error.message : String(error) });
  }
}

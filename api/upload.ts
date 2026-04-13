import { put } from '@vercel/blob';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Load Firebase config manually
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase Client SDK for metadata
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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

    // Upload to Vercel Blob (Fixing the "already exists" error)
    const blob = await put(`imports/${fileId}/${filename}`, req, {
      access: 'public',
      contentType: contentType,
      addRandomSuffix: true, // This prevents the "already exists" error
    });

    // Store metadata in Firestore
    await setDoc(doc(db, 'imports', fileId), {
      fileName: filename,
      blobUrl: blob.url,
      createdAt: new Date().toISOString()
    });

    res.json({ 
      id: fileId, 
      url: `https://wide-pdf.vercel.app/import?id=${fileId}`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

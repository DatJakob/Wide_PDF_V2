import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Load Firebase config manually
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

export default async function handler(req: any, res: any) {
  const id = req.query.id as string;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }

  try {
    // Get metadata from Firestore using Admin SDK
    const doc = await db.collection('imports').doc(id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const data = doc.data();
    const file = bucket.file(data?.storagePath);

    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'File not found in storage' });
    }

    const [metadata] = await file.getMetadata();
    const [content] = await file.download();

    res.setHeader('Content-Type', metadata.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data?.fileName}"`);
    res.send(content);
  } catch (error) {
    console.error('File retrieval error:', error);
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
  }
}

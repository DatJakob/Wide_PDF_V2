import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Load Firebase config manually
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

export default async function handler(req: any, res: any) {
  const id = req.query.id as string;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }

  const bucketsToTry = [
    firebaseConfig.storageBucket,
    `${firebaseConfig.projectId}.appspot.com`,
    firebaseConfig.projectId
  ];

  let lastError = null;

  for (const bucketName of bucketsToTry) {
    try {
      if (admin.apps.length) {
        await Promise.all(admin.apps.map(app => app?.delete()));
      }

      admin.initializeApp({
        projectId: firebaseConfig.projectId,
        storageBucket: bucketName
      });

      const db = admin.firestore();
      const bucket = admin.storage().bucket(bucketName);

      const doc = await db.collection('imports').doc(id).get();
      if (!doc.exists) {
        // If metadata doesn't exist in this project's firestore, it's a real 404
        return res.status(404).json({ error: 'File metadata not found' });
      }

      const data = doc.data();
      const file = bucket.file(data?.storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        // Try next bucket
        throw new Error('File not found in this bucket');
      }

      const [metadata] = await file.getMetadata();
      const [content] = await file.download();

      res.setHeader('Content-Type', metadata.contentType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${data?.fileName}"`);
      return res.send(content);
    } catch (error) {
      console.error(`Retrieval failed with bucket ${bucketName}:`, error);
      lastError = error;
    }
  }

  res.status(500).json({ 
    error: 'File retrieval failed', 
    details: lastError instanceof Error ? lastError.message : String(lastError) 
  });
}

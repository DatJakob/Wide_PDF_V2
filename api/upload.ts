import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Load Firebase config manually
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bucketsToTry = [
    firebaseConfig.storageBucket,
    `${firebaseConfig.projectId}.appspot.com`,
    firebaseConfig.projectId
  ];

  let lastError = null;

  for (const bucketName of bucketsToTry) {
    try {
      // Clear existing apps to re-initialize with new bucket if needed
      if (admin.apps.length) {
        await Promise.all(admin.apps.map(app => app?.delete()));
      }

      admin.initializeApp({
        projectId: firebaseConfig.projectId,
        storageBucket: bucketName
      });

      const db = admin.firestore();
      const bucket = admin.storage().bucket(bucketName);

      const filename = (req.headers['x-filename'] as string) || 'document.pdf';
      const contentType = req.headers['content-type'] || 'application/pdf';
      const fileId = uuidv4();
      const storagePath = `imports/${fileId}/${filename}`;
      const file = bucket.file(storagePath);

      await new Promise((resolve, reject) => {
        const stream = file.createWriteStream({
          metadata: { contentType },
          resumable: false
        });
        req.pipe(stream).on('error', reject).on('finish', resolve);
      });

      await db.collection('imports').doc(fileId).set({
        fileName: filename,
        storagePath: storagePath,
        createdAt: new Date().toISOString()
      });

      return res.json({ 
        id: fileId, 
        url: `https://wide-pdf.vercel.app/import?id=${fileId}`,
        bucketUsed: bucketName
      });
    } catch (error) {
      console.error(`Failed with bucket ${bucketName}:`, error);
      lastError = error;
      // Continue to next bucket
    }
  }

  res.status(500).json({ 
    error: 'Upload failed after trying all buckets', 
    details: lastError instanceof Error ? lastError.message : String(lastError),
    bucketsTried: bucketsToTry
  });
}

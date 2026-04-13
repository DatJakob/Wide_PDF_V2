import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, getBytes, getMetadata } from 'firebase/storage';
import fs from 'fs';
import path from 'path';

// Load Firebase config manually to avoid ESM import issues
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase Client SDK
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const storage = getStorage(app);

export default async function handler(req: any, res: any) {
  const id = req.query.id as string;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }

  try {
    // Get metadata from Firestore using Client SDK
    const docRef = doc(db, 'imports', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'File not found' });
    }

    const data = docSnap.data();
    const fileRef = ref(storage, data?.storagePath);

    // Download file and metadata using Client SDK
    const [metadata, content] = await Promise.all([
      getMetadata(fileRef),
      getBytes(fileRef)
    ]);

    res.setHeader('Content-Type', metadata.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${data?.fileName}"`);
    res.send(Buffer.from(content));
  } catch (error) {
    console.error('File retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

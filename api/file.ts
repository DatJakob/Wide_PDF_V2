import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Load Firebase config manually
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase Client SDK
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default async function handler(req: any, res: any) {
  const id = req.query.id as string;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }

  try {
    // Get metadata from Firestore
    const docRef = doc(db, 'imports', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'File metadata not found' });
    }

    const data = docSnap.data();
    const blobUrl = data?.blobUrl;

    if (!blobUrl) {
      return res.status(404).json({ error: 'Blob URL not found' });
    }

    // Redirect to the Vercel Blob URL
    res.redirect(blobUrl);
  } catch (error) {
    console.error('File retrieval error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}

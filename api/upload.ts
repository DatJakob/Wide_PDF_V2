import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Load Firebase config manually to avoid ESM import issues
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase Client SDK
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const storage = getStorage(app);

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to convert stream to buffer
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filename = (req.headers['x-filename'] as string) || 'document.pdf';
    const contentType = req.headers['content-type'] || 'application/pdf';
    
    const fileId = uuidv4();
    const storagePath = `imports/${fileId}/${filename}`;
    const storageRef = ref(storage);
    const fileRef = ref(storage, storagePath);

    // Read the stream into a buffer
    const buffer = await streamToBuffer(req);

    // Upload to Firebase Storage using Client SDK
    await uploadBytes(fileRef, buffer, {
      contentType: contentType,
    });

    // Store metadata in Firestore using Client SDK
    await setDoc(doc(db, 'imports', fileId), {
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
    res.status(500).json({ error: 'Upload failed' });
  }
}

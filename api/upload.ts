import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';

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
    // Note: In Vercel Serverless, we'd typically use a library like 'formidable' 
    // to parse multipart/form-data. For this example, we assume the file is sent 
    // as a raw body or we use a simpler approach.
    // To keep it robust for Vercel, we'll use the request directly if it's a stream.
    
    const filename = req.headers['x-filename'] || 'document.pdf';
    const contentType = req.headers['content-type'] || 'application/pdf';
    
    const blob = await put(filename, req, {
      access: 'private',
      addRandomSuffix: true,
      contentType: contentType,
    });

    // We use the blob URL as the ID or store the mapping
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://wide-pdf.vercel.app';
    const encodedId = Buffer.from(blob.url).toString('base64');
    
    res.json({ 
      id: encodedId, 
      url: `${baseUrl}/import?id=${encodedId}`,
      expiresIn: 'Depends on Vercel Blob settings'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
}

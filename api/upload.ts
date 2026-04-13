import { put } from '@vercel/blob';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const filename = req.headers.get('x-filename') || 'document.pdf';
    const contentType = req.headers.get('content-type') || 'application/pdf';
    
    // Edge functions can stream the request body directly to Vercel Blob
    const blob = await put(filename, req.body!, {
      access: 'private',
      addRandomSuffix: false,
      contentType: contentType,
    });

    const baseUrl = 'https://wide-pdf.vercel.app';
    const encodedId = btoa(blob.url);
    
    return new Response(JSON.stringify({ 
      id: encodedId, 
      url: `${baseUrl}/import?id=${encodedId}`,
      expiresIn: 'Depends on Vercel Blob settings'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

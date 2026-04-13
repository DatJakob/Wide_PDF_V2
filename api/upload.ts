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
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      throw new Error('Missing BLOB_READ_WRITE_TOKEN');
    }

    // Direct fetch to Vercel Blob REST API (bypasses library issues in Edge)
    const vercelBlobResponse = await fetch(`https://blob.vercel-storage.com/${filename}?addRandomSuffix=false`, {
      method: 'PUT',
      body: req.body,
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-version': '7',
        'content-type': contentType,
      },
    });

    if (!vercelBlobResponse.ok) {
      const errorText = await vercelBlobResponse.text();
      console.error('Vercel Blob API error:', errorText);
      throw new Error(`Upload to Vercel Blob failed: ${vercelBlobResponse.statusText}`);
    }

    const blob = await vercelBlobResponse.json();
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
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

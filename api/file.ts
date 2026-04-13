export default async function handler(req: any, res: any) {
  const id = req.query.id as string;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }

  try {
    // Decode the URL from the ID (using Buffer for Node.js robustness)
    const fileUrl = Buffer.from(id, 'base64').toString('utf-8');
    
    // Fetch the private blob using the administrative token
    const response = await fetch(fileUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
      }
    });

    if (!response.ok) {
      console.error(`Fetch failed with status: ${response.status}`);
      throw new Error('File not found or access denied');
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/pdf';

    res.setHeader('Content-Type', contentType);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('File retrieval error:', error);
    res.status(404).json({ error: 'File not found or expired' });
  }
}

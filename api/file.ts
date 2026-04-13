export default async function handler(req: any, res: any) {
  const id = req.query.id as string;
  
  if (!id) {
    return res.status(400).json({ error: 'Missing ID' });
  }

  try {
    const fileUrl = atob(id); // Decode the URL from the ID
    
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('File not found');

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/pdf';

    res.setHeader('Content-Type', contentType);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('File retrieval error:', error);
    res.status(404).json({ error: 'File not found or expired' });
  }
}

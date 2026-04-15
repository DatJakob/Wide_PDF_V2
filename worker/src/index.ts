export interface Env {
  INBOX_KV: KVNamespace;
  SHORTCUT_UPLOAD_TOKEN?: string;
  APP_URL?: string;
}

type SessionFileRecord = {
  fileId: string;
  fileName: string;
  createdAt: string;
  size: number;
  contentType: string;
};

type SessionRecord = {
  sessionId: string;
  expiresAt: string;
  files: SessionFileRecord[];
};

const SESSION_TTL_SECONDS = 60 * 60;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id, X-Shortcut-Token, X-Filename',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const createJsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init?.headers || {}),
    },
  });

const buildSessionKey = (sessionId: string) => `session:${sessionId}`;
const buildFileKey = (sessionId: string, fileId: string) => `file:${sessionId}:${fileId}`;

const parseRequestFile = async (request: Request) => {
  const contentType = request.headers.get('content-type') || 'application/pdf';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new Error('No file uploaded.');
    }

    return {
      fileName: file.name || 'document.pdf',
      contentType: file.type || 'application/pdf',
      bytes: await file.arrayBuffer(),
    };
  }

  return {
    fileName: request.headers.get('x-filename') || 'document.pdf',
    contentType,
    bytes: await request.arrayBuffer(),
  };
};

const getSession = async (env: Env, sessionId: string) => {
  const session = await env.INBOX_KV.get<SessionRecord>(buildSessionKey(sessionId), 'json');
  if (!session) {
    return null;
  }

  return session.expiresAt <= new Date().toISOString() ? null : session;
};

const saveSession = async (env: Env, session: SessionRecord) => {
  await env.INBOX_KV.put(buildSessionKey(session.sessionId), JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
};

const parseBodyJson = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

const createFileUrl = (request: Request, sessionId: string, fileId: string) => {
  const url = new URL(request.url);
  url.pathname = '/session-file';
  url.search = `?sessionId=${encodeURIComponent(sessionId)}&fileId=${encodeURIComponent(fileId)}`;
  return url.toString();
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    if (request.method === 'POST' && url.pathname === '/session-upload') {
      const sessionId = (request.headers.get('x-session-id') || '').trim();
      const uploadToken = request.headers.get('x-shortcut-token') || '';

      if (!sessionId) {
        return createJsonResponse({ error: 'Missing sessionId.' }, { status: 400 });
      }

      if (env.SHORTCUT_UPLOAD_TOKEN && uploadToken !== env.SHORTCUT_UPLOAD_TOKEN) {
        return createJsonResponse({ error: 'Invalid shortcut token.' }, { status: 403 });
      }

      const { fileName, contentType, bytes } = await parseRequestFile(request);
      if (!bytes.byteLength) {
        return createJsonResponse({ error: 'No file uploaded.' }, { status: 400 });
      }

      if (bytes.byteLength > MAX_FILE_SIZE_BYTES) {
        return createJsonResponse({ error: 'File exceeds 25 MB limit.' }, { status: 413 });
      }

      if (!contentType.toLowerCase().includes('pdf') && !fileName.toLowerCase().endsWith('.pdf')) {
        return createJsonResponse({ error: 'Only PDF uploads are allowed.' }, { status: 400 });
      }

      const existingSession = await getSession(env, sessionId);
      const fileId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
      const nextFile: SessionFileRecord = {
        fileId,
        fileName,
        createdAt: nowIso,
        size: bytes.byteLength,
        contentType: 'application/pdf',
      };

      const session: SessionRecord = existingSession
        ? { ...existingSession, expiresAt, files: [...existingSession.files, nextFile] }
        : { sessionId, expiresAt, files: [nextFile] };

      await env.INBOX_KV.put(buildFileKey(sessionId, fileId), bytes, {
        expirationTtl: SESSION_TTL_SECONDS,
        metadata: {
          fileName,
          contentType: 'application/pdf',
        },
      });
      await saveSession(env, session);

      return createJsonResponse({
        sessionId,
        fileId,
        openUrl: `${(env.APP_URL || 'https://wide-pdf-v2.vercel.app').replace(/\/$/, '')}/?session=${encodeURIComponent(sessionId)}`,
        expiresAt,
      });
    }

    if (request.method === 'GET' && url.pathname === '/session-files') {
      const sessionId = (url.searchParams.get('sessionId') || '').trim();
      if (!sessionId) {
        return createJsonResponse({ error: 'Missing sessionId.' }, { status: 400 });
      }

      const session = await getSession(env, sessionId);
      if (!session) {
        return createJsonResponse({ error: 'Session not found or expired.', sessionId, isExpired: true, files: [], fileCount: 0, expiresAt: null }, { status: 404 });
      }

      return createJsonResponse({
        sessionId,
        expiresAt: session.expiresAt,
        isExpired: false,
        fileCount: session.files.length,
        files: session.files.map((file) => ({
          ...file,
          downloadUrl: createFileUrl(request, sessionId, file.fileId),
        })),
      });
    }

    if (request.method === 'GET' && url.pathname === '/session-file') {
      const sessionId = (url.searchParams.get('sessionId') || '').trim();
      const fileId = (url.searchParams.get('fileId') || '').trim();

      if (!sessionId || !fileId) {
        return createJsonResponse({ error: 'Missing sessionId or fileId.' }, { status: 400 });
      }

      const session = await getSession(env, sessionId);
      const fileMeta = session?.files.find((file) => file.fileId === fileId);
      if (!session || !fileMeta) {
        return createJsonResponse({ error: 'File not found or expired.' }, { status: 404 });
      }

      const value = await env.INBOX_KV.get(buildFileKey(sessionId, fileId), 'arrayBuffer');
      if (!value) {
        return createJsonResponse({ error: 'File not found or expired.' }, { status: 404 });
      }

      return new Response(value, {
        status: 200,
        headers: {
          'Content-Type': fileMeta.contentType,
          'Content-Disposition': `attachment; filename="${fileMeta.fileName}"`,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/clear-session') {
      const payload = await parseBodyJson<{ sessionId?: string }>(request);
      const sessionId = (payload?.sessionId || '').trim();

      if (!sessionId) {
        return createJsonResponse({ error: 'Missing sessionId.' }, { status: 400 });
      }

      const session = await env.INBOX_KV.get<SessionRecord>(buildSessionKey(sessionId), 'json');
      if (session) {
        await Promise.all(
          session.files.map((file) => env.INBOX_KV.delete(buildFileKey(sessionId, file.fileId))),
        );
      }

      await env.INBOX_KV.delete(buildSessionKey(sessionId));
      return createJsonResponse({ ok: true });
    }

    return createJsonResponse({ error: 'Not found.' }, { status: 404 });
  },
};

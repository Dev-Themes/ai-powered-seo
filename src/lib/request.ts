export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}

export async function boundedBody(r: Request, limit: number): Promise<Buffer> {
  if (Number(r.headers.get('content-length') || 0) > limit) {
    throw new RequestError('Request too large.', 413);
  }
  const reader = r.body?.getReader();
  if (!reader) throw new RequestError('Missing request body.', 400);

  let count = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    count += value.byteLength;
    if (count > limit) {
      await reader.cancel();
      throw new RequestError('Request too large.', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function boundedJson(r: Request, limit = 160000): Promise<Record<string, unknown>> {
  if (!r.headers.get('content-type')?.startsWith('application/json')) {
    throw new RequestError('Expected JSON.', 415);
  }
  try {
    const buffer = await boundedBody(r, limit);
    return JSON.parse(buffer.toString('utf8'));
  } catch (e) {
    if (e instanceof RequestError) throw e;
    throw new RequestError('Invalid JSON.', 400);
  }
}

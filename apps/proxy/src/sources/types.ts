// Contrato de las fuentes upstream. Capa A (Cache API + coalescing) y capa B
// (Durable Object FeedHub) implementan la misma interfaz.

export interface FeedRequest {
  key: string;
  url: URL;
  ttlSeconds: number;
  accept?: 'protobuf' | 'json';
}

export interface FeedResult {
  body: ArrayBuffer;
  fetchedAt: number;
  fromCache: boolean;
  stale: boolean;
  upstreamStatus: number;
}

export interface FeedSource {
  fetch(req: FeedRequest): Promise<FeedResult>;
}

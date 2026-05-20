interface CompressionStream extends TransformStream<Uint8Array, Uint8Array> {
  readonly format: string;
}

interface DecompressionStream extends TransformStream<Uint8Array, Uint8Array> {
  readonly format: string;
}

declare var CompressionStream: {
  prototype: CompressionStream;
  new(format: 'deflate' | 'deflate-raw' | 'gzip'): CompressionStream;
};

declare var DecompressionStream: {
  prototype: DecompressionStream;
  new(format: 'deflate' | 'deflate-raw' | 'gzip'): DecompressionStream;
};

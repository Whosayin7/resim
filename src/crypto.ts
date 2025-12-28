async function kdf(key: string, salt: string = ''): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

function u32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) |
          (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) |
          bytes[offset + 3]) >>> 0;
}

async function chaoticKeystream(length: number, key: string): Promise<Uint8Array> {
  const h = await kdf(key, 'ks:');

  let x = (u32(h, 0) + 1) / (Math.pow(2, 32) + 2);
  const r = 3.99 - ((u32(h, 4) % 1000) / 1_000_000.0);

  const stream = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    x = r * x * (1.0 - x);
    stream[i] = Math.floor(x * 256.0) & 0xFF;
  }
  return stream;
}

async function permutationIndices(n: number, key: string): Promise<Uint32Array> {
  const h = await kdf(key, 'perm:');

  let seed = 0n;
  for (let i = 0; i < 16; i++) {
    seed = (seed << 8n) | BigInt(h[i]);
  }

  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    idx[i] = i;
  }

  let state = Number(seed % BigInt(2**31 - 1));
  function lcgRandom() {
    state = (state * 1103515245 + 12345) % (2**31);
    return state / (2**31);
  }

  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(lcgRandom() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }

  return idx;
}

function inversePermutation(idx: Uint32Array): Uint32Array {
  const inv = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    inv[idx[i]] = i;
  }
  return inv;
}

async function diffuseEncrypt(data: Uint8Array, key: string): Promise<Uint8Array> {
  const h = await kdf(key, 'diff:');
  const iv = h[0];
  const ks = await chaoticKeystream(data.length, key);

  const out = new Uint8Array(data.length);
  let prev = iv;
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ ks[i] ^ prev;
    prev = out[i];
  }
  return out;
}

async function diffuseDecrypt(data: Uint8Array, key: string): Promise<Uint8Array> {
  const h = await kdf(key, 'diff:');
  const iv = h[0];
  const ks = await chaoticKeystream(data.length, key);

  const out = new Uint8Array(data.length);
  let prev = iv;
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    out[i] = c ^ ks[i] ^ prev;
    prev = c;
  }
  return out;
}

export async function encryptImage(imageData: ImageData, key: string): Promise<ImageData> {
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8Array(imageData.data);

  const rgbFlat = new Uint8Array(width * height * 3);
  let rgbIdx = 0;
  for (let i = 0; i < data.length; i += 4) {
    rgbFlat[rgbIdx++] = data[i];
    rgbFlat[rgbIdx++] = data[i + 1];
    rgbFlat[rgbIdx++] = data[i + 2];
  }

  const idx = await permutationIndices(rgbFlat.length, key);
  const permuted = new Uint8Array(rgbFlat.length);
  for (let i = 0; i < rgbFlat.length; i++) {
    permuted[i] = rgbFlat[idx[i]];
  }

  const cipherFlat = await diffuseEncrypt(permuted, key);

  const result = new ImageData(width, height);
  let cipherIdx = 0;
  for (let i = 0; i < result.data.length; i += 4) {
    result.data[i] = cipherFlat[cipherIdx++];
    result.data[i + 1] = cipherFlat[cipherIdx++];
    result.data[i + 2] = cipherFlat[cipherIdx++];
    result.data[i + 3] = 255;
  }

  return result;
}

export async function decryptImage(imageData: ImageData, key: string): Promise<ImageData> {
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8Array(imageData.data);

  const rgbFlat = new Uint8Array(width * height * 3);
  let rgbIdx = 0;
  for (let i = 0; i < data.length; i += 4) {
    rgbFlat[rgbIdx++] = data[i];
    rgbFlat[rgbIdx++] = data[i + 1];
    rgbFlat[rgbIdx++] = data[i + 2];
  }

  const permuted = await diffuseDecrypt(rgbFlat, key);

  const idx = await permutationIndices(permuted.length, key);
  const inv = inversePermutation(idx);
  const plainFlat = new Uint8Array(permuted.length);
  for (let i = 0; i < permuted.length; i++) {
    plainFlat[i] = permuted[inv[i]];
  }

  const result = new ImageData(width, height);
  let plainIdx = 0;
  for (let i = 0; i < result.data.length; i += 4) {
    result.data[i] = plainFlat[plainIdx++];
    result.data[i + 1] = plainFlat[plainIdx++];
    result.data[i + 2] = plainFlat[plainIdx++];
    result.data[i + 3] = 255;
  }

  return result;
}

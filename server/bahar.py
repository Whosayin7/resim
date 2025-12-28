from PIL import Image
import numpy as np
import hashlib

def kdf(key: str) -> bytes:
    return hashlib.sha256(key.encode("utf-8")).digest()

def u32(b: bytes) -> int:
    return int.from_bytes(b, "big") & 0xffffffff

# 1) Daha iyi keystream (kaos + anahtardan güçlü başlangıç)
def chaotic_keystream(length: int, key: str) -> np.ndarray:
    h = kdf("ks:" + key)

    # x0: 0..1 arası yüksek çözünürlükte
    x = (u32(h[0:4]) + 1) / (2**32 + 2)
    # r: kaotik bölgede, anahtara bağlı çok küçük oynama
    r = 3.99 - ((u32(h[4:8]) % 1000) / 1_000_000.0)

    stream = np.empty(length, dtype=np.uint8)
    for i in range(length):
        x = r * x * (1.0 - x)
        stream[i] = int(x * 256.0) & 0xFF
    return stream

# 2) Permütasyon: bayt yerlerini anahtara bağlı karıştır
def permutation_indices(n: int, key: str) -> np.ndarray:
    h = kdf("perm:" + key)
    seed = int.from_bytes(h[:16], "big")
    rng = np.random.default_rng(seed)
    idx = np.arange(n, dtype=np.int64)
    rng.shuffle(idx)
    return idx

def inverse_permutation(idx: np.ndarray) -> np.ndarray:
    inv = np.empty_like(idx)
    inv[idx] = np.arange(len(idx), dtype=idx.dtype)
    return inv

# 3) Difüzyon: CBC-benzeri geri besleme (silueti öldüren kısım)
def diffuse_encrypt(data: np.ndarray, key: str) -> np.ndarray:
    h = kdf("diff:" + key)
    iv = h[0]  # 1 byte IV
    ks = chaotic_keystream(len(data), key)

    out = np.empty_like(data)
    prev = iv
    for i in range(len(data)):
        out[i] = data[i] ^ ks[i] ^ prev
        prev = out[i]
    return out

def diffuse_decrypt(data: np.ndarray, key: str) -> np.ndarray:
    h = kdf("diff:" + key)
    iv = h[0]
    ks = chaotic_keystream(len(data), key)

    out = np.empty_like(data)
    prev = iv
    for i in range(len(data)):
        c = data[i]
        out[i] = c ^ ks[i] ^ prev
        prev = c
    return out

def encrypt_image(input_path: str, output_path: str, key: str):
    arr = np.array(Image.open(input_path).convert("RGB"), dtype=np.uint8)
    flat = arr.flatten()

    idx = permutation_indices(len(flat), key)
    permuted = flat[idx]

    cipher_flat = diffuse_encrypt(permuted, key)
    cipher = cipher_flat.reshape(arr.shape)

    Image.fromarray(cipher).save(output_path)  # mode yok -> uyarı yok
    print(f"Şifreli kaydedildi: {output_path}")

def decrypt_image(input_path: str, output_path: str, key: str):
    arr = np.array(Image.open(input_path).convert("RGB"), dtype=np.uint8)
    flat = arr.flatten()

    permuted = diffuse_decrypt(flat, key)

    idx = permutation_indices(len(permuted), key)
    inv = inverse_permutation(idx)
    plain_flat = permuted[inv]

    plain = plain_flat.reshape(arr.shape)
    Image.fromarray(plain).save(output_path)
    print(f"Çözülmüş kaydedildi: {output_path}")

if __name__ == "__main__":
    ANAHTAR = "FraktalBahar2025"

    encrypt_image("orijinal.png", "sifreli.png", ANAHTAR)
    decrypt_image("sifreli.png", "cozulmus.png", ANAHTAR)

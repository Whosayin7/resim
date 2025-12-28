import { useState, useRef } from 'react';
import { Lock, Unlock, Upload, Download, AlertCircle } from 'lucide-react';
import { encryptImage, decryptImage } from './crypto';

function App() {
  const [key, setKey] = useState(' ');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Lütfen geçerli bir görüntü dosyası seçin');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setOriginalImage(event.target?.result as string);
      setProcessedImage(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (operation: 'encrypt' | 'decrypt') => {
    if (!originalImage || !canvasRef.current) return;

    if (!key.trim()) {
      setError('Lütfen bir şifreleme anahtarı girin');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const img = new Image();
      img.onload = async () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let resultData: ImageData;
        if (operation === 'encrypt') {
          resultData = await encryptImage(imageData, key);
        } else {
          resultData = await decryptImage(imageData, key);
        }

        ctx.putImageData(resultData, 0, 0);
        setProcessedImage(canvas.toDataURL('image/png'));
        setProcessing(false);
      };
      img.src = originalImage;
    } catch (err) {
      setError('İşlem sırasında bir hata oluştu');
      setProcessing(false);
      console.error(err);
    }
  };

  const downloadImage = () => {
    if (!processedImage) return;

    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'processed-image.png';
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
             Görüntü Şifreleme
            </h1>
            <p className="text-slate-400 text-lg">
              Kaotik harita tabanlı güvenli görüntü şifreleme sistemi
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-8 border border-slate-700">
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-slate-300">
                Şifreleme Anahtarı
              </label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="Güçlü bir anahtar girin..."
              />
            </div>

            <div className="mb-6">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 rounded-lg font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Upload size={20} />
                Görüntü Yükle
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-300">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {originalImage && (
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <button
                  onClick={() => processImage('encrypt')}
                  disabled={processing}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
                >
                  <Lock size={20} />
                  {processing ? 'İşleniyor...' : 'Şifrele'}
                </button>
                <button
                  onClick={() => processImage('decrypt')}
                  disabled={processing}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
                >
                  <Unlock size={20} />
                  {processing ? 'İşleniyor...' : 'Çöz'}
                </button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 text-emerald-400">Orijinal Görüntü</h2>
              <div className="aspect-square bg-slate-900/50 rounded-lg flex items-center justify-center overflow-hidden">
                {originalImage ? (
                  <img src={originalImage} alt="Original" className="max-w-full max-h-full object-contain" />
                ) : (
                  <p className="text-slate-500">Görüntü yüklenmedi</p>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-cyan-400">İşlenmiş Görüntü</h2>
                {processedImage && (
                  <button
                    onClick={downloadImage}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-all"
                  >
                    <Download size={16} />
                    İndir
                  </button>
                )}
              </div>
              <div className="aspect-square bg-slate-900/50 rounded-lg flex items-center justify-center overflow-hidden">
                {processedImage ? (
                  <img src={processedImage} alt="Processed" className="max-w-full max-h-full object-contain" />
                ) : (
                  <p className="text-slate-500">İşlenmiş görüntü yok</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 bg-slate-800/30 backdrop-blur-lg rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-lg font-semibold mb-3 text-emerald-400">Nasıl Kullanılır?</h3>
            <ol className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>Güvenli bir şifreleme anahtarı girin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>Şifrelemek istediğiniz görüntüyü yükleyin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>Şifrele butonuna tıklayarak görüntüyü şifreleyin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span>Aynı anahtar ile Çöz butonuna tıklayarak orijinal görüntüyü geri alın</span>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default App;

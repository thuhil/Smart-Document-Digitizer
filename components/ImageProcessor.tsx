import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ImageProcessingSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { Sliders, RotateCw, Check, X } from 'lucide-react';

interface ImageProcessorProps {
  imageData: string;
  onProcessComplete: (processedImage: string) => void;
  onCancel: () => void;
}

const ImageProcessor: React.FC<ImageProcessorProps> = ({ imageData, onProcessComplete, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<ImageProcessingSettings>(DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);

  // Apply filters using Canvas API (Simulating OpenCV operations)
  const applyFilters = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = imageData;
    img.onload = () => {
      // Handle Rotation Dimensions
      if (settings.rotation % 180 !== 0) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      
      // Move to center, rotate, move back
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((settings.rotation * Math.PI) / 180);
      if (settings.rotation % 180 !== 0) {
        ctx.drawImage(img, -img.height / 2, -img.width / 2);
      } else {
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
      }
      ctx.restore();

      // Get pixel data for pixel-level manipulation (Thresholding/Grayscale)
      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageDataObj.data;

      const contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Grayscale (Weighted method)
        if (settings.grayscale || settings.threshold > 0) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          r = g = b = gray;
        }

        // Brightness
        r += settings.brightness;
        g += settings.brightness;
        b += settings.brightness;

        // Contrast
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;

        // Thresholding (Binarization) - Key for OCR
        if (settings.threshold > 0) {
            const v = (r + g + b) / 3; // already grayscale, but just to be safe
            const bin = v >= settings.threshold ? 255 : 0;
            r = g = b = bin;
        }

        // Clamp values
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }

      ctx.putImageData(imageDataObj, 0, 0);
    };
  }, [imageData, settings]);

  useEffect(() => {
    // Debounce the filter application for performance
    const timer = setTimeout(applyFilters, 100);
    return () => clearTimeout(timer);
  }, [applyFilters]);

  const handleSave = () => {
    if (canvasRef.current) {
      setIsProcessing(true);
      // Small delay to allow UI to update
      setTimeout(() => {
        const processed = canvasRef.current!.toDataURL('image/png');
        onProcessComplete(processed);
      }, 50);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-full app-card rounded-xl shadow-lg overflow-hidden border app-border">
      {/* Processor Header */}
      <div className="p-4 border-b app-border flex justify-between items-center bg-[var(--bg-sidebar)] shrink-0">
        <h3 className="text-lg font-semibold flex items-center gap-2 app-text">
          <Sliders className="w-5 h-5 text-[var(--accent)]" />
          Pre-process Image
        </h3>
        <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1 text-sm font-medium app-text-muted hover:app-text transition-colors">
                Cancel
            </button>
            <button 
                onClick={handleSave} 
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-1.5 app-accent text-white text-sm font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
                {isProcessing ? 'Processing...' : <><Check className="w-4 h-4" /> Next: Extract Data</>}
            </button>
        </div>
      </div>

      {/* Main Processor Area */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Canvas Display Area */}
        <div ref={containerRef} className="flex-1 bg-black/5 dark:bg-black/20 p-4 md:p-8 overflow-auto flex items-center justify-center relative min-h-0">
            <canvas ref={canvasRef} className="max-w-full max-h-full shadow-2xl border-2 border-[var(--border)] object-contain" />
        </div>

        {/* Controls Sidebar */}
        <div className="w-full lg:w-80 app-card lg:border-l app-border p-6 overflow-y-auto shrink-0 bg-[var(--bg-card)]">
            <div className="space-y-6">
              <div className="space-y-4">
                  <div className="flex justify-between items-center">
                      <label className="text-sm font-medium app-text">Rotation</label>
                      <button 
                          onClick={() => setSettings(s => ({ ...s, rotation: (s.rotation + 90) % 360 }))}
                          className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors border app-border"
                          title="Rotate 90 degrees"
                      >
                          <RotateCw className="w-4 h-4 app-text-muted" />
                      </button>
                  </div>
              </div>

              <hr className="app-border opacity-50" />

              {/* Brightness */}
              <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold app-text-muted uppercase tracking-wider">
                      <span>Brightness</span>
                      <span className="text-[var(--accent)]">{settings.brightness}</span>
                  </div>
                  <input 
                      type="range" min="-100" max="100" 
                      value={settings.brightness}
                      onChange={(e) => setSettings({...settings, brightness: Number(e.target.value)})}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      style={{accentColor: 'var(--accent)'}}
                  />
              </div>

              {/* Contrast */}
              <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold app-text-muted uppercase tracking-wider">
                      <span>Contrast</span>
                      <span className="text-[var(--accent)]">{settings.contrast}</span>
                  </div>
                  <input 
                      type="range" min="-100" max="100" 
                      value={settings.contrast}
                      onChange={(e) => setSettings({...settings, contrast: Number(e.target.value)})}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      style={{accentColor: 'var(--accent)'}}
                  />
              </div>

              <hr className="app-border opacity-50" />

              {/* Advanced CV Filters */}
              <div className="space-y-5">
                  <h4 className="text-sm font-bold app-text flex items-center gap-2">
                    OCR Enhancement
                  </h4>
                  
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-main)] border app-border">
                      <label className="text-sm font-medium app-text">Grayscale</label>
                      <button 
                          onClick={() => setSettings(s => ({...s, grayscale: !s.grayscale}))}
                          className={`w-11 h-6 flex items-center rounded-full transition-colors duration-200 ${settings.grayscale ? 'app-accent' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                          <span className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ${settings.grayscale ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                  </div>

                  {/* Thresholding */}
                  <div className="space-y-3">
                      <div className="flex justify-between text-xs font-semibold app-text-muted uppercase tracking-wider">
                          <span>Binarization</span>
                          <span className="text-[var(--accent)]">{settings.threshold === 0 ? 'Off' : settings.threshold}</span>
                      </div>
                      <input 
                          type="range" min="0" max="255" 
                          value={settings.threshold}
                          onChange={(e) => setSettings({...settings, threshold: Number(e.target.value)})}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                          style={{accentColor: 'var(--accent)'}}
                      />
                      <p className="text-[11px] leading-tight app-text-muted opacity-80">
                        High contrast black/white conversion. Ideal for removing shadows from text documents.
                      </p>
                  </div>
              </div>

              <div className="pt-4">
                <button 
                    onClick={() => setSettings(DEFAULT_SETTINGS)}
                    className="w-full py-2.5 text-xs font-bold uppercase tracking-widest app-text-muted hover:app-text border app-border rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                >
                    Reset All Filters
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImageProcessor;
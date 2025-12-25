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
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sliders className="w-5 h-5 text-primary-500" />
          Pre-process Image
        </h3>
        <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
                Cancel
            </button>
            <button 
                onClick={handleSave} 
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
                {isProcessing ? 'Processing...' : <><Check className="w-4 h-4" /> Next: Extract Data</>}
            </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 overflow-auto flex items-center justify-center relative">
            <canvas ref={canvasRef} className="max-w-full max-h-[60vh] shadow-xl border-2 border-white dark:border-slate-700" />
        </div>

        {/* Controls Sidebar */}
        <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 overflow-y-auto space-y-6">
            
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Rotation</label>
                    <button 
                        onClick={() => setSettings(s => ({ ...s, rotation: (s.rotation + 90) % 360 }))}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                        title="Rotate 90 degrees"
                    >
                        <RotateCw className="w-4 h-4 text-slate-500" />
                    </button>
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* Brightness */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                    <span>Brightness</span>
                    <span>{settings.brightness}</span>
                </div>
                <input 
                    type="range" min="-100" max="100" 
                    value={settings.brightness}
                    onChange={(e) => setSettings({...settings, brightness: Number(e.target.value)})}
                    className="w-full accent-primary-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Contrast */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                    <span>Contrast</span>
                    <span>{settings.contrast}</span>
                </div>
                <input 
                    type="range" min="-100" max="100" 
                    value={settings.contrast}
                    onChange={(e) => setSettings({...settings, contrast: Number(e.target.value)})}
                    className="w-full accent-primary-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* Advanced CV Filters */}
            <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">OCR Enhancement</h4>
                
                <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-600 dark:text-slate-400">Grayscale</label>
                    <button 
                        onClick={() => setSettings(s => ({...s, grayscale: !s.grayscale}))}
                        className={`w-11 h-6 flex items-center rounded-full transition-colors duration-200 ${settings.grayscale ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                        <span className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ${settings.grayscale ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {/* Thresholding */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>Binarization Threshold</span>
                        <span>{settings.threshold === 0 ? 'Off' : settings.threshold}</span>
                    </div>
                    <input 
                        type="range" min="0" max="255" 
                        value={settings.threshold}
                        onChange={(e) => setSettings({...settings, threshold: Number(e.target.value)})}
                        className="w-full accent-primary-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-slate-400">High contrast black/white conversion. Ideal for text documents.</p>
                </div>
            </div>

            <button 
                onClick={() => setSettings(DEFAULT_SETTINGS)}
                className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
                Reset All Filters
            </button>
        </div>
      </div>
    </div>
  );
};

export default ImageProcessor;
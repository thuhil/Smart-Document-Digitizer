import React, { useState, useEffect } from 'react';
import { AppState, ProcessingStatus } from './types';
import { extractGenericTable } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import ImageProcessor from './components/ImageProcessor';
import ResultsTable from './components/ResultsTable';
import { Upload, Moon, Sun, Loader2, Sparkles, FileSpreadsheet, ScanLine } from 'lucide-react';

const App: React.FC = () => {
  // Theme Management
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // App State
  const [state, setState] = useState<AppState>({
    originalImage: null,
    processedImage: null,
    extractedData: [],
    status: 'idle',
    errorMessage: null,
    isDarkMode: false
  });

  // Handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setState(prev => ({ ...prev, status: 'uploading', errorMessage: null }));
      const base64 = await fileToBase64(file);
      setState(prev => ({ ...prev, originalImage: base64, status: 'processing' }));
    } catch (error) {
      setState(prev => ({ ...prev, status: 'error', errorMessage: 'Failed to load image.' }));
    }
  };

  const handleProcessComplete = async (processedImage: string) => {
    setState(prev => ({ ...prev, processedImage, status: 'extracting' }));
    try {
      const data = await extractGenericTable(processedImage);
      setState(prev => ({ ...prev, extractedData: data, status: 'complete' }));
    } catch (error) {
        console.error(error);
      setState(prev => ({ 
          ...prev, 
          status: 'error', 
          errorMessage: error instanceof Error ? error.message : "Failed to extract data."
        }));
    }
  };

  const handleReset = () => {
    setState(prev => ({
      ...prev,
      originalImage: null,
      processedImage: null,
      extractedData: [],
      status: 'idle',
      errorMessage: null
    }));
  };

  // Render Helpers
  const renderContent = () => {
    switch (state.status) {
      case 'idle':
      case 'uploading':
        return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors p-10">
            <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-6 text-primary-600 dark:text-primary-400">
                <Upload className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Upload Document</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-center max-w-md">
              Drag and drop or click to upload an image of a table, invoice, or handwritten note.
            </p>
            <label className="relative cursor-pointer bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5">
              <span>Choose File</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
            <div className="mt-8 flex gap-8 text-sm text-slate-400">
                <span className="flex items-center gap-2"><ScanLine className="w-4 h-4" /> AI OCR</span>
                <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Auto-Format</span>
                <span className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel Ready</span>
            </div>
          </div>
        );

      case 'processing':
        return state.originalImage ? (
          <ImageProcessor 
            imageData={state.originalImage} 
            onProcessComplete={handleProcessComplete}
            onCancel={handleReset}
          />
        ) : null;

      case 'extracting':
        return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <Loader2 className="w-16 h-16 text-primary-500 animate-spin mb-6" />
            <h3 className="text-xl font-semibold mb-2">Analyzing Document...</h3>
            <p className="text-slate-500 dark:text-slate-400">Gemini 3.0 is extracting your data.</p>
          </div>
        );

      case 'complete':
        return (
          <ResultsTable data={state.extractedData} onReset={handleReset} />
        );

      case 'error':
        return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-500">
                <span className="text-3xl font-bold">!</span>
            </div>
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Something went wrong</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-md">{state.errorMessage}</p>
            <button 
                onClick={handleReset}
                className="px-6 py-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg font-medium"
            >
                Try Again
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                    <Sparkles className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-purple-600 dark:from-primary-400 dark:to-purple-400">
                    VisionToData
                </h1>
            </div>
            
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-400 text-sm">
        <p>Powered by Gemini 3.0 Vision & React</p>
      </footer>
    </div>
  );
};

export default App;
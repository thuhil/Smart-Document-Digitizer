import React, { useState, useEffect, useCallback } from 'react';
import { AppState, Page, ThemeOption } from './types';
import { extractGenericTable } from './services/geminiService';
import { fileToBase64, convertPdfToImages, downloadExcelMultiSheet, downloadExcelMasterSheet } from './utils/fileUtils';
import ImageProcessor from './components/ImageProcessor';
import ResultsTable from './components/ResultsTable';
import { 
  Upload, Loader2, Sparkles, FileSpreadsheet, 
  Layout, ChevronRight, FileText, 
  Trash2, Play, CheckCircle, AlertCircle, FolderInput,
  ChevronDown
} from 'lucide-react';

// --- Theme Configurations ---
const themes: Record<ThemeOption, string> = {
  light: `
    --bg-main: #f8fafc; --bg-card: #ffffff; --bg-sidebar: #f1f5f9;
    --text-main: #0f172a; --text-muted: #64748b;
    --border: #e2e8f0; --accent: #4f46e5; --accent-hover: #4338ca;
  `,
  dark: `
    --bg-main: #0f172a; --bg-card: #1e293b; --bg-sidebar: #020617;
    --text-main: #f8fafc; --text-muted: #94a3b8;
    --border: #334155; --accent: #6366f1; --accent-hover: #818cf8;
  `,
  grey: `
    --bg-main: #e5e5e5; --bg-card: #d4d4d4; --bg-sidebar: #a3a3a3;
    --text-main: #171717; --text-muted: #404040;
    --border: #737373; --accent: #262626; --accent-hover: #171717;
  `,
  warm: `
    --bg-main: #fef3c7; --bg-card: #fffbeb; --bg-sidebar: #fde68a;
    --text-main: #78350f; --text-muted: #92400e;
    --border: #fcd34d; --accent: #d97706; --accent-hover: #b45309;
  `
};

const ThemeSelector: React.FC<{ 
  current: ThemeOption; 
  onChange: (t: ThemeOption) => void; 
}> = ({ current, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] border app-border rounded-full shadow-sm hover:shadow-md transition-all app-text"
      >
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-400" />
        <span className="text-sm font-medium capitalize">{current}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-32 bg-[var(--bg-card)] border app-border rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200">
            {(['light', 'dark', 'grey', 'warm'] as ThemeOption[]).map(t => (
              <button
                key={t}
                onClick={() => { onChange(t); setIsOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm capitalize flex items-center gap-2 transition-colors ${
                  current === t 
                  ? 'bg-[var(--accent)] text-white' 
                  : 'app-text hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    pages: [],
    selectedPageId: null,
    globalStatus: 'idle',
    theme: 'light'
  });

  const [isDragging, setIsDragging] = useState(false);

  // Inject Theme CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      :root {
        ${themes[state.theme]}
      }
      body { background-color: var(--bg-main); color: var(--text-main); }
      .app-card { background-color: var(--bg-card); border-color: var(--border); }
      .app-sidebar { background-color: var(--bg-sidebar); border-right-color: var(--border); }
      .app-text { color: var(--text-main); }
      .app-text-muted { color: var(--text-muted); }
      .app-border { border-color: var(--border); }
      .app-accent { background-color: var(--accent); color: white; }
      .app-accent:hover { background-color: var(--accent-hover); }
      .app-accent-text { color: var(--accent); }
    `;
    const oldStyle = document.getElementById('theme-style');
    if (oldStyle) oldStyle.remove();
    style.id = 'theme-style';
    document.head.appendChild(style);

    // Tailwind Dark Mode Sync
    if (state.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

  }, [state.theme]);

  // Unified File Processing Logic
  const processUploadedFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    
    setState(prev => ({ ...prev, globalStatus: 'uploading' }));
    
    const newPages: Page[] = [];

    for (const file of files) {
      try {
        if (file.type === 'application/pdf') {
          const images = await convertPdfToImages(file);
          images.forEach((img, idx) => {
            newPages.push({
              id: Math.random().toString(36).substr(2, 9),
              name: `${file.name} - Page ${idx + 1}`,
              originalImage: img,
              processedImage: img,
              extractedData: null,
              status: 'idle',
              errorMessage: null
            });
          });
        } else if (file.type.startsWith('image/')) {
          const base64 = await fileToBase64(file);
          newPages.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            originalImage: base64,
            processedImage: base64,
            extractedData: null,
            status: 'idle',
            errorMessage: null
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }

    setState(prev => ({
      ...prev,
      pages: [...prev.pages, ...newPages],
      selectedPageId: prev.selectedPageId || newPages[0]?.id || null,
      globalStatus: 'idle'
    }));
  }, []);

  // Event Handlers
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      await processUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      await processUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processPage = async (pageId: string) => {
    const page = state.pages.find(p => p.id === pageId);
    if (!page || !page.processedImage) return;

    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === pageId ? { ...p, status: 'extracting' } : p)
    }));

    try {
      const data = await extractGenericTable(page.processedImage);
      setState(prev => ({
        ...prev,
        pages: prev.pages.map(p => p.id === pageId ? { ...p, extractedData: data, status: 'complete' } : p)
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        pages: prev.pages.map(p => p.id === pageId ? { ...p, status: 'error', errorMessage: err.message } : p)
      }));
    }
  };

  const processAll = async () => {
    const idlePages = state.pages.filter(p => p.status === 'idle' || p.status === 'error');
    for (const page of idlePages) {
      await processPage(page.id);
    }
  };

  const handlePageUpdate = (pageId: string, newImage: string) => {
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === pageId ? { ...p, processedImage: newImage } : p)
    }));
    // Auto trigger extraction after processing
    processPage(pageId);
  };

  // UI Components
  const selectedPage = state.pages.find(p => p.id === state.selectedPageId);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 app-sidebar border-r flex flex-col z-20 shadow-xl transition-all duration-300">
        <div className="p-4 border-b app-border flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[var(--accent)]" />
          <h1 className="font-bold text-lg app-text">Smart Document Digitizer</h1>
        </div>

        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
          {/* File Upload (Small - only visible when pages exist to save space) */}
          {state.pages.length > 0 && (
            <div>
              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed app-border rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <Upload className="w-5 h-5 app-text-muted mb-1" />
                <span className="text-[10px] app-text-muted">Add more files</span>
                <input type="file" className="hidden" multiple accept="image/*,.pdf" onChange={handleFileInput} />
              </label>
            </div>
          )}

          {/* Actions - Only visible if there are pages */}
          {state.pages.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold app-text-muted uppercase mb-3">Actions</h3>
              <button 
                onClick={processAll}
                className="w-full flex items-center justify-center gap-2 py-2 mb-2 app-accent rounded-md text-sm font-medium shadow-sm"
              >
                <Play className="w-4 h-4" /> Process All Pending
              </button>
              
              <div className="space-y-2 mt-4">
                 <button 
                  onClick={() => downloadExcelMultiSheet(state.pages)}
                  className="w-full flex items-center gap-2 px-3 py-2 border app-border rounded-md text-sm app-text hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel (Multi-sheet)
                </button>
                <button 
                  onClick={() => downloadExcelMasterSheet(state.pages)}
                  className="w-full flex items-center gap-2 px-3 py-2 border app-border rounded-md text-sm app-text hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Layout className="w-4 h-4 text-blue-600" /> Excel (Master Sheet)
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        {/* Top Right Theme Selector */}
        <div className="absolute top-4 right-4 z-50">
          <ThemeSelector 
            current={state.theme} 
            onChange={(t) => setState(s => ({ ...s, theme: t }))} 
          />
        </div>

        {state.pages.length === 0 ? (
          // --- EMPTY STATE / DRAG & DROP ZONE ---
           <div 
             className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-200 ${
               isDragging ? 'bg-[var(--accent)] bg-opacity-5' : ''
             }`}
             onDragOver={handleDragOver}
             onDragLeave={handleDragLeave}
             onDrop={handleDrop}
           >
             <div className="flex flex-col items-center text-center mb-10 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="w-20 h-20 bg-[var(--bg-card)] rounded-full shadow-lg border app-border flex items-center justify-center mb-6 ring-4 ring-slate-100 dark:ring-slate-800">
                 <FileText className="w-10 h-10 text-[var(--accent)]" strokeWidth={1.5} />
               </div>
               <h1 className="text-3xl md:text-4xl font-bold app-text mb-4 tracking-tight">Smart Document Digitizer</h1>
               <p className="text-lg app-text-muted leading-relaxed">
                 Upload scanned documents or PDFs. We'll automatically digitize tables, handwriting, and text into Excel.
               </p>
             </div>

             <label 
               className={`flex flex-col items-center justify-center w-full max-w-2xl h-64 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${
                 isDragging 
                 ? 'border-[var(--accent)] scale-105 bg-[var(--bg-card)] shadow-xl' 
                 : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-black/5 dark:hover:bg-white/5 hover:border-[var(--accent)]'
               }`}
             >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm transition-colors ${isDragging ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-main)] app-text-muted'}`}>
                  {isDragging ? <FolderInput className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                </div>
                <h2 className="text-xl font-bold app-text mb-2">
                  {isDragging ? 'Drop Files Here' : 'Upload PDF or Images'}
                </h2>
                <div className="px-6 py-2 rounded-full app-accent font-medium shadow-md text-sm mt-2">
                   Select Files
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  multiple 
                  accept="image/*,.pdf" 
                  onChange={handleFileInput} 
                />
             </label>
           </div>
        ) : (
          <div className="flex h-full">
            {/* Page List */}
            <div className="w-64 border-r app-border app-card overflow-y-auto">
              {state.pages.map((page, idx) => (
                <div 
                  key={page.id}
                  onClick={() => setState(s => ({ ...s, selectedPageId: page.id }))}
                  className={`p-3 border-b app-border cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${
                    state.selectedPageId === page.id ? 'bg-black/5 dark:bg-white/10 border-l-4 border-l-[var(--accent)]' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold app-text truncate w-32">{page.name}</span>
                    <StatusIcon status={page.status} />
                  </div>
                  <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded overflow-hidden relative">
                     <img src={page.processedImage || page.originalImage} className="w-full h-full object-cover opacity-80" />
                  </div>
                </div>
              ))}
            </div>

            {/* Workspace */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[var(--bg-main)]">
              {selectedPage ? (
                <div className="flex-1 flex flex-col h-full">
                  <header className="h-14 border-b app-border flex items-center justify-between px-4 app-card">
                     <h2 className="font-semibold app-text truncate pr-20">{selectedPage.name}</h2>
                     <button 
                       onClick={() => setState(s => ({ ...s, pages: s.pages.filter(p => p.id !== selectedPage.id), selectedPageId: null }))}
                       className="p-2 text-red-500 hover:bg-red-50 rounded"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </header>
                  
                  <div className="flex-1 overflow-auto p-4">
                    {selectedPage.status === 'extracting' ? (
                       <div className="h-full flex flex-col items-center justify-center">
                          <Loader2 className="w-10 h-10 animate-spin text-[var(--accent)] mb-4" />
                          <p className="app-text">Extracting data with Gemini 1.5...</p>
                       </div>
                    ) : selectedPage.extractedData ? (
                       <div className="h-full flex flex-col">
                          <div className="mb-4 flex justify-end">
                            <button 
                               onClick={() => setState(s => ({ 
                                 ...s, 
                                 pages: s.pages.map(p => p.id === selectedPage.id ? { ...p, extractedData: null } : p) 
                               }))}
                               className="text-xs app-text-muted hover:text-[var(--accent)] underline"
                            >
                              Re-process Image
                            </button>
                          </div>
                          <div className="flex-1 app-card rounded-lg border app-border overflow-hidden shadow-sm">
                            <ResultsTable 
                               data={selectedPage.extractedData} 
                               onReset={() => {}} // Handled by button above
                            />
                          </div>
                       </div>
                    ) : (
                       <div className="h-full flex flex-col items-center">
                          <div className="w-full max-w-4xl h-[60vh] mb-4">
                             <ImageProcessor 
                               imageData={selectedPage.originalImage} 
                               onProcessComplete={(img) => handlePageUpdate(selectedPage.id, img)}
                               onCancel={() => {}}
                             />
                          </div>
                          <p className="text-xs app-text-muted mt-2">
                             Tip: Use the controls above to crop/rotate before extracting.
                          </p>
                       </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center app-text-muted">
                   Select a page to view
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'complete': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'extracting': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    default: return <div className="w-4 h-4 rounded-full border-2 border-slate-300" />;
  }
};

export default App;
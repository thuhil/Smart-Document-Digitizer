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
  ChevronDown, Plus, AlertTriangle
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
        <span className="text-sm font-medium capitalize hidden sm:inline">{current}</span>
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

const checkConsistency = (currentPages: Page[]): Page[] => {
  const completedPages = currentPages.filter(p => p.status === 'complete' && p.extractedData);
  if (completedPages.length < 2) return currentPages;

  // 1. Normalize Headers (Description) - Collect superset
  const allHeaders = new Set<string>();
  completedPages.forEach(p => {
    p.extractedData?.forEach(row => {
      Object.keys(row).forEach(k => allHeaders.add(k));
    });
  });
  const headerArray = Array.from(allHeaders);

  // 2. Determine Mode Row Count
  const rowCounts = completedPages.map(p => p.extractedData?.length || 0);
  const countsMap = new Map<number, number>();
  let maxFreq = 0;
  let modeCount = rowCounts[0];

  rowCounts.forEach(c => {
    const freq = (countsMap.get(c) || 0) + 1;
    countsMap.set(c, freq);
    if (freq > maxFreq) {
      maxFreq = freq;
      modeCount = c;
    }
  });

  return currentPages.map(p => {
    if (p.status !== 'complete' || !p.extractedData) return p;

    // Normalize Data Headers: Ensure every row has all headers
    const normalizedData = p.extractedData.map(row => {
      const newRow: any = { ...row };
      headerArray.forEach(h => {
        if (!(h in newRow)) newRow[h] = ""; // Fill missing with empty string
      });
      return newRow;
    });

    // Check Row Count
    let warning = undefined;
    if (normalizedData.length !== modeCount) {
      warning = `Row count mismatch: Found ${normalizedData.length}, expected ${modeCount} based on similar pages.`;
    }

    return {
      ...p,
      extractedData: normalizedData,
      consistencyWarning: warning
    };
  });
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

  // Fixed: Re-written to avoid relying on stale closure state
  const processPage = useCallback(async (page: Page) => {
    const imageToProcess = page.processedImage || page.originalImage;
    if (!imageToProcess) return;

    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === page.id ? { ...p, status: 'extracting', consistencyWarning: undefined } : p)
    }));

    try {
      const data = await extractGenericTable(imageToProcess);
      setState(prev => ({
        ...prev,
        pages: prev.pages.map(p => p.id === page.id ? { ...p, extractedData: data, status: 'complete' } : p)
      }));
    } catch (err: any) {
      console.error(`Error processing page ${page.id}:`, err);
      setState(prev => ({
        ...prev,
        pages: prev.pages.map(p => p.id === page.id ? { ...p, status: 'error', errorMessage: err.message } : p)
      }));
    }
  }, []);

  const processAll = useCallback(async () => {
    // Note: We use the snapshot of state.pages from when processAll is triggered
    const idlePages = state.pages.filter(p => p.status === 'idle' || p.status === 'error');
    if (idlePages.length === 0) return;

    setState(prev => ({ ...prev, globalStatus: 'extracting' }));
    
    // Parallel processing for all pending pages
    await Promise.all(idlePages.map(page => processPage(page)));
    
    // Run consistency check and normalization after batch completes
    setState(prev => ({ 
      ...prev, 
      pages: checkConsistency(prev.pages),
      globalStatus: 'idle' 
    }));
  }, [state.pages, processPage]);

  const handlePageUpdate = (pageId: string, newImage: string) => {
    setState(prev => {
      const updatedPages = prev.pages.map(p => p.id === pageId ? { ...p, processedImage: newImage } : p);
      return { ...prev, pages: updatedPages };
    });
    
    const page = state.pages.find(p => p.id === pageId);
    if (page) {
      processPage({ ...page, processedImage: newImage });
    }
  };

  const handleResetPage = (pageId: string) => {
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === pageId ? { ...p, extractedData: null, status: 'idle', consistencyWarning: undefined } : p)
    }));
  };

  // UI Components
  const selectedPage = state.pages.find(p => p.id === state.selectedPageId);
  const isGlobalProcessing = state.globalStatus === 'extracting' || state.pages.some(p => p.status === 'extracting');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-main)]">
      {/* Top Header */}
      <header className="h-16 px-6 border-b app-border bg-[var(--bg-card)] flex items-center justify-between shrink-0 z-30 transition-colors shadow-sm">
        <div className="flex items-center gap-3">
           <div className="w-9 h-9 bg-gradient-to-br from-[var(--accent)] to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md">
             <Sparkles className="w-5 h-5" />
           </div>
           <h1 className="font-bold text-lg app-text tracking-tight hidden sm:block">Smart Document Digitizer</h1>
        </div>

        <div className="flex items-center gap-4">
           {state.pages.length > 0 && (
             <div className="flex items-center gap-3 mr-2 border-r app-border pr-4">
                
                {/* Actions Group */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bg-main)] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-[var(--accent)] border app-border transition-all" title="Add more files">
                    <Plus className="w-5 h-5" />
                    <input type="file" className="hidden" multiple accept="image/*,.pdf" onChange={handleFileInput} />
                  </label>
                  
                  <button 
                    onClick={processAll}
                    disabled={isGlobalProcessing}
                    className="flex items-center gap-2 px-4 py-1.5 app-accent text-white rounded-full text-sm font-medium shadow-md hover:opacity-90 transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                    title="Batch Process Pending Pages"
                  >
                    {isGlobalProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span className="hidden md:inline">{isGlobalProcessing ? 'Processing...' : 'Batch Process'}</span>
                  </button>

                  <div className="flex items-center bg-[var(--bg-main)] rounded-full border app-border p-0.5 ml-2">
                     <button 
                      onClick={() => downloadExcelMultiSheet(state.pages)}
                      className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-green-600 transition-colors"
                      title="Export Excel (Multi-sheet)"
                     >
                       <FileSpreadsheet className="w-4 h-4" />
                     </button>
                     <div className="w-px h-4 bg-[var(--border)] mx-0.5"></div>
                     <button 
                      onClick={() => downloadExcelMasterSheet(state.pages)}
                      className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-blue-600 transition-colors"
                      title="Export Excel (Master Sheet)"
                     >
                       <Layout className="w-4 h-4" />
                     </button>
                  </div>
                </div>
             </div>
           )}

           <ThemeSelector 
             current={state.theme} 
             onChange={(t) => setState(s => ({ ...s, theme: t }))} 
           />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
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
               <div className="w-24 h-24 bg-[var(--bg-card)] rounded-[2rem] shadow-xl border app-border flex items-center justify-center mb-8 relative">
                 <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent)] to-purple-500 opacity-10 rounded-[2rem]"></div>
                 <FileText className="w-12 h-12 text-[var(--accent)]" strokeWidth={1.5} />
               </div>
               <h2 className="text-4xl font-bold app-text mb-4 tracking-tight">Drop files to begin</h2>
               <p className="text-lg app-text-muted leading-relaxed max-w-lg">
                 We'll automatically digitize tables, handwriting, and forms into structured Excel data.
               </p>
             </div>

             <label 
               className={`flex flex-col items-center justify-center w-full max-w-5xl h-96 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 group ${
                 isDragging 
                 ? 'border-[var(--accent)] scale-105 bg-[var(--bg-card)] shadow-2xl' 
                 : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] hover:shadow-lg'
               }`}
             >
                <div className="flex flex-col items-center gap-3 group-hover:scale-105 transition-transform duration-300">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-colors ${isDragging ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-main)] app-text-muted group-hover:text-[var(--accent)]'}`}>
                    {isDragging ? <FolderInput className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <div className="text-center">
                    <span className="font-semibold app-text text-lg">Click to Upload</span>
                    <span className="block text-sm app-text-muted mt-1">or drag and drop PDF/Images</span>
                  </div>
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
          <div className="flex w-full h-full">
            {/* Page List - Left Panel */}
            <div className="w-64 border-r app-border app-card overflow-y-auto flex-shrink-0">
              <div className="p-3 text-xs font-semibold app-text-muted uppercase tracking-wider sticky top-0 bg-[var(--bg-card)] z-10 border-b app-border backdrop-blur-sm bg-opacity-90">
                Pages ({state.pages.length})
              </div>
              {state.pages.map((page, idx) => (
                <div 
                  key={page.id}
                  onClick={() => setState(s => ({ ...s, selectedPageId: page.id }))}
                  className={`p-3 border-b app-border cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors group ${
                    state.selectedPageId === page.id ? 'bg-black/5 dark:bg-white/10 border-l-4 border-l-[var(--accent)]' : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium app-text truncate w-32" title={page.name}>{page.name}</span>
                    <StatusIcon status={page.status} warning={page.consistencyWarning} />
                  </div>
                  <div className="aspect-[3/4] bg-[var(--bg-main)] rounded-md overflow-hidden relative border app-border shadow-sm group-hover:shadow-md transition-all">
                     <img src={page.processedImage || page.originalImage} className="w-full h-full object-cover" />
                     {/* Overlay for actions if needed */}
                  </div>
                  {page.consistencyWarning && (
                    <div className="mt-2 text-[10px] leading-tight text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-1.5 rounded border border-amber-200 dark:border-amber-800">
                      {page.consistencyWarning}
                    </div>
                  )}
                </div>
              ))}
              <div className="p-4 flex justify-center">
                 <label className="flex items-center gap-2 text-xs font-medium app-text-muted hover:text-[var(--accent)] cursor-pointer transition-colors">
                    <Plus className="w-4 h-4" /> Add more pages
                    <input type="file" className="hidden" multiple accept="image/*,.pdf" onChange={handleFileInput} />
                 </label>
              </div>
            </div>

            {/* Workspace - Right Panel */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[var(--bg-main)]">
              {selectedPage ? (
                <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300 overflow-hidden">
                  <header className="h-14 border-b app-border flex items-center justify-between px-6 app-card shrink-0">
                     <div className="flex items-center gap-2 overflow-hidden">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--bg-main)] border app-border app-text-muted">
                           Page {state.pages.findIndex(p => p.id === selectedPage.id) + 1}
                        </span>
                        <h2 className="font-semibold app-text truncate max-w-md">{selectedPage.name}</h2>
                     </div>
                     <button 
                       onClick={() => setState(s => ({ ...s, pages: s.pages.filter(p => p.id !== selectedPage.id), selectedPageId: null }))}
                       className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                       title="Delete Page"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </header>
                  
                  <div className="flex-1 overflow-hidden p-4 md:p-6 flex flex-col">
                    {selectedPage.status === 'extracting' ? (
                       <div className="h-full flex flex-col items-center justify-center">
                          <div className="relative">
                            <div className="absolute inset-0 bg-[var(--accent)] blur-xl opacity-20 rounded-full animate-pulse"></div>
                            <Loader2 className="w-12 h-12 animate-spin text-[var(--accent)] mb-4 relative z-10" />
                          </div>
                          <h3 className="text-lg font-medium app-text mb-2">Digitizing Document</h3>
                          <p className="app-text-muted">Gemini is extracting tables and handwriting...</p>
                       </div>
                    ) : selectedPage.extractedData ? (
                       <div className="h-full flex flex-col overflow-hidden">
                          <div className="mb-4 flex justify-between items-end shrink-0">
                            <h3 className="text-lg font-semibold app-text">Extraction Results</h3>
                            {selectedPage.consistencyWarning && (
                              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="w-4 h-4" />
                                {selectedPage.consistencyWarning}
                              </div>
                            )}
                            <button 
                               onClick={() => handleResetPage(selectedPage.id)}
                               className="text-xs font-medium app-text-muted hover:text-[var(--accent)] flex items-center gap-1 transition-colors ml-auto"
                            >
                              <ChevronRight className="w-3 h-3 rotate-180" /> Re-process Image
                            </button>
                          </div>
                          <div className="flex-1 app-card rounded-xl border app-border overflow-hidden shadow-lg">
                            <ResultsTable 
                               data={selectedPage.extractedData} 
                               onReset={() => handleResetPage(selectedPage.id)} 
                            />
                          </div>
                       </div>
                    ) : (
                       <div className="flex-1 flex flex-col overflow-hidden">
                          <ImageProcessor 
                            imageData={selectedPage.originalImage} 
                            onProcessComplete={(img) => handlePageUpdate(selectedPage.id, img)}
                            onCancel={() => {}}
                          />
                       </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center app-text-muted">
                   <Layout className="w-16 h-16 mb-4 opacity-20" />
                   <p>Select a page from the list to view or edit</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const StatusIcon = ({ status, warning }: { status: string, warning?: string }) => {
  if (warning) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  switch (status) {
    case 'complete': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'extracting': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    default: return <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />;
  }
};

export default App;
export interface ExtractedDataRow {
  [key: string]: string | number | boolean | null;
}

export type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'extracting' | 'complete' | 'error';

export interface Page {
  id: string;
  name: string;
  originalImage: string; // Base64
  processedImage: string | null;
  extractedData: ExtractedDataRow[] | null;
  status: ProcessingStatus;
  errorMessage: string | null;
}

export type ThemeOption = 'light' | 'dark' | 'grey' | 'warm';

export interface AppState {
  pages: Page[];
  selectedPageId: string | null;
  globalStatus: ProcessingStatus;
  theme: ThemeOption;
}

export interface ImageProcessingSettings {
  brightness: number;
  contrast: number;
  threshold: number;
  grayscale: boolean;
  rotation: number;
}
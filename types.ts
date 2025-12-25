export interface ExtractedDataRow {
  [key: string]: string | number | boolean | null;
}

export type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'extracting' | 'complete' | 'error';

export interface AppState {
  originalImage: string | null;
  processedImage: string | null;
  extractedData: ExtractedDataRow[];
  status: ProcessingStatus;
  errorMessage: string | null;
  isDarkMode: boolean;
}

export interface ImageProcessingSettings {
  brightness: number;
  contrast: number;
  threshold: number; // 0-255, 0 means disabled
  grayscale: boolean;
  rotation: number;
}
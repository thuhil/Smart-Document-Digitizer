import { ExtractedDataRow, Page } from "../types";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";

// PDF.js setup - handle different module export formats (ESM vs CJS interop)
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Version must match exactly the version in index.html importmap for compatibility
const PDFJS_VERSION = '3.11.174';

/**
 * Configure PDF.js GlobalWorkerOptions.
 * We use unpkg as it provides a more reliable direct path to the worker file
 * that avoids common 'esm.sh' bundling issues with importScripts.
 */
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const convertPdfToImages = async (file: File): Promise<string[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Force re-verify worker source before each document processing
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
    }

    const loadingTask = pdfjs.getDocument({ 
      data: arrayBuffer,
      // Standard character maps for rendering complex fonts
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
      // standardFontDataUrl can also be added if specific errors persist
    });
    
    const pdf = await loadingTask.promise;
    const images: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // High quality scale
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.9));
    }
    
    return images;
  } catch (error) {
    console.error("PDF conversion error details:", error);
    // Provide a more descriptive error if it's worker related
    if (error instanceof Error && (error.message.includes("Worker") || error.message.includes("fake"))) {
      throw new Error("The PDF processing engine failed to initialize correctly. This is often due to a network restriction or a missing worker script. Please check your internet connection and try again.");
    }
    throw error;
  }
};

// Excel Export Functions
export const downloadExcelMultiSheet = (pages: Page[], filename: string = 'digitized_data.xlsx') => {
  const wb = XLSX.utils.book_new();
  
  let hasData = false;
  pages.forEach((page, index) => {
    if (page.extractedData && page.extractedData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(page.extractedData);
      const sheetName = `Page ${index + 1}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Max 31 chars for sheet name
      hasData = true;
    }
  });

  if (hasData) {
    XLSX.writeFile(wb, filename);
  } else {
    alert("No extracted data available to export.");
  }
};

export const downloadExcelMasterSheet = (pages: Page[], filename: string = 'master_data.xlsx') => {
  const combinedData: any[] = [];
  
  pages.forEach((page, index) => {
    if (page.extractedData) {
      page.extractedData.forEach(row => {
        combinedData.push({
          "Page Number": index + 1,
          "Source File": page.name,
          ...row
        });
      });
    }
  });

  if (combinedData.length > 0) {
    const ws = XLSX.utils.json_to_sheet(combinedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Data");
    XLSX.writeFile(wb, filename);
  } else {
    alert("No extracted data available to export.");
  }
};

export const downloadCSV = (data: ExtractedDataRow[], filename: string = 'data.csv') => {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
};
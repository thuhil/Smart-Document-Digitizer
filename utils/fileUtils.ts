import { ExtractedDataRow, Page } from "../types";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";

// Fix for "Cannot set properties of undefined (setting 'workerSrc')"
// Handle different module export structures (ESM vs CJS interop) by checking for default
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Initialize PDF.js worker
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
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
  const arrayBuffer = await file.arrayBuffer();
  // Use the properly resolved pdfjs object to call getDocument
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
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

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    images.push(canvas.toDataURL("image/jpeg", 0.9));
  }
  
  return images;
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
import { ExtractedDataRow } from "../types";

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const downloadCSV = (data: ExtractedDataRow[], filename: string = 'data.csv') => {
  if (!data || data.length === 0) return;

  // Get all unique keys from all objects to build headers
  const keys = Array.from(new Set(data.flatMap(row => Object.keys(row))));
  
  const csvContent = [
    keys.join(','), // Header row
    ...data.map(row => keys.map(key => {
      const value = row[key];
      // Escape quotes and wrap in quotes if contains comma
      const stringValue = value === null || value === undefined ? '' : String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ExtractedDataRow } from "../types";

export const extractDataFromImage = async (base64Image: string): Promise<ExtractedDataRow[]> => {
  // We use the generic extractor as default now
  return extractGenericTable(base64Image);
};

export const extractGenericTable = async (base64Image: string): Promise<ExtractedDataRow[]> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
  
    // Create a new GoogleGenAI instance right before the call to ensure fresh configuration
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  
    try {
      // Using gemini-3-pro-preview for complex reasoning tasks like structured table and handwriting extraction
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/png", data: cleanBase64 } },
            { 
              text: `Extract the data from this table, including printed headers and handwritten row data. 
              If the image contains a form, extract key-value pairs.
              If it contains purely text, structure it into logical paragraphs or lines.
              Return purely a JSON array of objects. Identify headers automatically.` 
            }
          ]
        },
        config: {
          responseMimeType: "application/json"
        }
      });

      // Directly access the .text property from GenerateContentResponse as per SDK guidelines
      if (!response.text) throw new Error("Empty response from Gemini");
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Extraction error", e);
      throw e;
    }
};
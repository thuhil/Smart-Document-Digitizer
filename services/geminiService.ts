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
              text: `Extract the data from this image into a JSON array of objects.
              
              STRICT SCHEMA RULES:
              1. Tables: Use the visual column headers as JSON keys. Convert them to lower_snake_case (e.g., "First Name" -> "first_name").
              2. Forms/Key-Value Lists: strictly use keys "field" and "value".
              3. IDs: Do NOT generate artificial columns like "row_id", "id", or "row_number" unless that text explicitly appears in the document header row.
              4. Consistency: If the extracted data looks like a table, ensure all objects in the array have the same keys.
              
              Return ONLY the JSON array.` 
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
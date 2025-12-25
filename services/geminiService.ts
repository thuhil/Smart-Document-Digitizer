import { GoogleGenAI } from "@google/genai";
import { ExtractedDataRow } from "../types";

export const extractDataFromImage = async (base64Image: string): Promise<ExtractedDataRow[]> => {
  // We use the generic extractor as default now
  return extractGenericTable(base64Image);
};

export const extractGenericTable = async (base64Image: string): Promise<ExtractedDataRow[]> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
  
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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

      if (!response.text) throw new Error("Empty response from Gemini");
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Extraction error", e);
      throw e;
    }
};
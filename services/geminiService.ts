import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedDataRow } from "../types";

export const extractDataFromImage = async (base64Image: string): Promise<ExtractedDataRow[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Clean the base64 string if it contains the header
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png", // We convert everything to PNG in the processor
              data: cleanBase64
            }
          },
          {
            text: `Analyze the text, handwriting, or tables in this image. 
            Extract the structured data into a JSON array of objects. 
            If it is a table, preserve the headers as keys. 
            If it is a form, use field names as keys. 
            If it is unstructured notes, try to organize it logically into rows.
            Ensure all numbers are parsed as numbers where appropriate.
            Return ONLY the JSON array.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
               // We leave this open-ended to allow the model to define keys based on the image content
               // However, strictly typing it as STRING map for flexibility
               Field: { type: Type.STRING },
               Value: { type: Type.STRING },
               Notes: { type: Type.STRING }
            }
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("No data returned from Gemini.");
    }

    const data = JSON.parse(response.text);
    return data;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    // Fallback: Attempt to parse without schema if strict schema fails, or re-throw
    throw new Error("Failed to extract data from image. Please try a clearer image.");
  }
};

// Robust helper to handle dynamic JSON return if the strict schema above is too limiting for generic tables
export const extractGenericTable = async (base64Image: string): Promise<ExtractedDataRow[]> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
  
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: cleanBase64 } },
          { text: "Extract the data from this image into a JSON list of objects. Identify headers automatically. Return only the JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    if (!response.text) throw new Error("Empty response");
    return JSON.parse(response.text);
};
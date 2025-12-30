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

    const makeRequest = async (retryCount = 0): Promise<GenerateContentResponse> => {
        try {
            // Using gemini-3-pro-preview for complex reasoning tasks like structured table and handwriting extraction
            return await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: [
                  {
                    role: "user",
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
                  }
                ],
                config: {
                  responseMimeType: "application/json"
                }
            });
        } catch (e: any) {
            // Check for Rate Limit (429) or Resource Exhausted errors
            const isRateLimit = 
                e.status === 429 || 
                (e.response && e.response.status === 429) || 
                (e.message && (e.message.includes("429") || e.message.includes("quota") || e.message.includes("RESOURCE_EXHAUSTED")));

            if (isRateLimit && retryCount < 3) {
                // Exponential backoff: 2s, 4s, 8s + jitter
                const delay = Math.pow(2, retryCount) * 2000 + (Math.random() * 500); 
                console.warn(`Gemini API Rate limit hit. Retrying in ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return makeRequest(retryCount + 1);
            }
            throw e;
        }
    };
  
    try {
      const response = await makeRequest();

      // Directly access the .text property from GenerateContentResponse as per SDK guidelines
      if (!response.text) throw new Error("Empty response from Gemini");

      // Robust JSON parsing: Remove Markdown code blocks if present
      const cleanedText = response.text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedText);
    } catch (e) {
      console.error("Extraction error", e);
      throw e;
    }
};
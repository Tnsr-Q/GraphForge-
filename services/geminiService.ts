import { GoogleGenAI } from "@google/genai";
import { GEMINI_SYSTEM_INSTRUCTION } from "../constants";

export async function generateG3DCode(prompt: string): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set. Please refer to the project README.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
            }
        });
        
        let text = response.text.trim();
        
        // Clean up markdown code block fences if they exist
        if (text.startsWith('```') && text.endsWith('```')) {
            text = text.substring(text.indexOf('\n') + 1, text.lastIndexOf('```')).trim();
        }

        return text;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to generate code from Gemini API.");
    }
}

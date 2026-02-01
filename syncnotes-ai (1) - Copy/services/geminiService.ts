
import { GoogleGenAI, Type } from "@google/genai";
import { Task, MindMapData } from "../types";

const apiKey = (import.meta.env.VITE_API_KEY as string | undefined) || '';
if (!apiKey) {
  console.warn('VITE_API_KEY not set. Generative API requests will fail. For production, use a server-side key to keep it secret.');
}
const ai = new GoogleGenAI({ apiKey });

const cleanJsonResponse = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

const retryWithTimeout = async <T>(fn: () => Promise<T>, timeoutMs: number, retries = 2): Promise<T> => {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs/1000}s`)), timeoutMs));
      return await Promise.race([fn(), timeoutPromise]) as T;
    } catch (err) {
      console.warn(`AI request attempt ${attempt} failed:`, err);
      if (attempt > retries) throw err;
      const backoff = 1000 * Math.pow(2, attempt - 1);
      await new Promise((res) => setTimeout(res, backoff));
    }
  }
};

export const processMeetingAudio = async (audioBase64: string, mimeType: string, agenda: string) => {

  const model = 'gemini-3-flash-preview';

  let result: any;
  try {
    result = await retryWithTimeout(() => ai.models.generateContent({
      model: model,
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBase64
              }
            },
            {
              text: `Act as an expert Stenographer and Business Intelligence Lead. 
              
              PART 1: VERBATIM TRANSCRIPTION
              Transcribe the entire audio file WORD-FOR-WORD. Do not skip filler words, do not summarize. Accuracy must be equivalent to Whisper Large-v3. Provide the full transcript.

              PART 2: STRUCTURED INTELLIGENCE
              Based on the transcript and the meeting agenda (${agenda}):
              1. Provide a concise executive summary.
              2. Identify EXACTLY three key strategy shifts discussed.
              3. Extract all actionable tasks. For each task, identify the specific person assigned (e.g., Alex, Riya, Aman).
              4. Provide a formal "Closing Conclusion" for a branded report.

              You MUST return the response strictly as a JSON object.`
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            summary: { type: Type.STRING },
            conclusion: { type: Type.STRING },
            strategyShifts: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  assignee: { type: Type.STRING }
                },
                required: ["title", "assignee"]
              }
            }
          },
          required: ["transcript", "summary", "strategyShifts", "tasks", "conclusion"]
        }
      }
    }), 120000, 2);
  } catch (err) {
    console.error('AI request failed after retries:', err);
    throw new Error(`AI request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const responseText = result.text;
    if (!responseText) throw new Error("AI returned no content.");
    const cleanedJson = cleanJsonResponse(responseText);
    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error("Critical AI Processing Error:", error);
    throw new Error("Failed to parse meeting intelligence. Please try again with clearer audio.");
  }
};

export const generateMindMap = async (summary: string): Promise<MindMapData> => {
  let result: any;
  try {
    result = await retryWithTimeout(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on this summary: "${summary}", generate a nested JSON mind map. 
      Root is the meeting theme. Children are primary topics.
      Format: { "name": "Theme", "children": [ { "name": "Topic", "children": [] } ] }`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            children: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  children: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } } }
                }
              }
            }
          }
        }
      }
    }), 60000, 1);
  } catch (err) {
    console.error('Mind map generation failed after retries:', err);
    throw new Error(`Mind map generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const cleaned = cleanJsonResponse(result.text || '{}');
    return JSON.parse(cleaned) as MindMapData;
  } catch {
    return { name: "Meeting Overview", children: [] };
  }
};

export const chatWithMeeting = async (meetingContext: string, history: any[], message: string) => {
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are SyncNotes AI. Answer questions strictly based on the provided meeting context: ${meetingContext}`,
    }
  });

  let response: any;
  try {
    response = await retryWithTimeout(() => chat.sendMessage({ message }), 15000, 1);
  } catch (err) {
    console.error('Chat request failed after retries:', err);
    throw new Error(`Chat request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return response.text;
};

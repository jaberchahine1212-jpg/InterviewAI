import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

type ChatMessage = { role: "user" | "assistant"; content: string };

app.get("/", (_req, res) => {
  res.json({ message: "InterviewAI API running", provider: "Google Gemini", version: "5.0" });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(ai),
    provider: "Google Gemini",
    model: MODEL
  });
});

app.post("/api/ask", async (req, res) => {
  const question = String(req.body.question || "").trim();
  const role = String(req.body.role || "General Technical Interview").trim();
  const level = String(req.body.level || "Junior").trim();
  const rawHistory = Array.isArray(req.body.history) ? req.body.history : [];

  const history: ChatMessage[] = rawHistory
    .filter((m: any) => ["user", "assistant"].includes(m?.role) && typeof m?.content === "string")
    .slice(-8)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!question) {
    return res.status(400).json({ message: "Question is required." });
  }

  if (!ai) {
    return res.status(503).json({
      message: "Gemini is not configured yet. Paste your API key into backend/.env and restart the backend."
    });
  }

  try {
    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      })),
      { role: "user", parts: [{ text: question }] }
    ];

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: `You are InterviewAI, a concise interview-preparation assistant. The user asks the questions and you answer them. Tailor each answer to a ${level} candidate targeting ${role}. Start with a clear interview-ready answer. Add a short explanation or example when useful, then finish with one practical interview tip. Keep answers focused, accurate, easy to study, and suitable for interview preparation.`,
        maxOutputTokens: 1200,
        temperature: 0.5
      }
    });

    const answer = String(response.text || "").trim();

    res.json({
      answer: answer || "I could not generate an answer. Please try again.",
      provider: "Google Gemini",
      model: MODEL
    });
  } catch (error: any) {
    console.error("Gemini request failed:", error?.message || error);
    res.status(500).json({
      message: error?.message
        ? `Gemini request failed: ${error.message}`
        : "The Gemini request failed. Check your API key and try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT} with Gemini (${MODEL})`);
  console.log(ai ? "Gemini API: configured" : "Gemini API: waiting for GEMINI_API_KEY in backend/.env");
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { GoogleGenAI } from "@google/genai";
import pool from "./database/connection";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const JWT_SECRET = (process.env.JWT_SECRET || "").trim();

const ai = API_KEY
  ? new GoogleGenAI({ apiKey: API_KEY })
  : null;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// ======================================================
// ROOT
// ======================================================

app.get("/", (_req, res) => {
  res.json({
    message: "InterviewAI API running",
    provider: "Google Gemini",
    version: "5.0"
  });
});

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      aiConfigured: Boolean(ai),
      databaseConnected: true,
      provider: "Google Gemini",
      model: MODEL
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      aiConfigured: Boolean(ai),
      databaseConnected: false,
      provider: "Google Gemini",
      model: MODEL
    });
  }
});

// ======================================================
// SIGN UP
// ======================================================

app.post("/api/auth/signup", async (req, res) => {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();

  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters."
    });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({
      message: "JWT_SECRET is not configured."
    });
  }

  try {
    // Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert user into PostgreSQL
    const result = await pool.query(
      `
      INSERT INTO users (email, password)
      VALUES ($1, $2)
      RETURNING id, email, created_at
      `,
      [email, hashedPassword]
    );

    const user = result.rows[0];

    // Create JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    return res.status(201).json({
      message: "Account created successfully.",
      token,
      user
    });
  } catch (error) {
    console.error("Signup failed:", error);

    return res.status(500).json({
      message: "Could not create account."
    });
  }
});

// ======================================================
// LOGIN
// ======================================================

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();

  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required."
    });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({
      message: "JWT_SECRET is not configured."
    });
  }

  try {
    // Find user
    const result = await pool.query(
      `
      SELECT id, email, password
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    const user = result.rows[0];

    // Compare entered password with hashed password
    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    // Create JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    return res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login failed:", error);

    return res.status(500).json({
      message: "Could not log in."
    });
  }
});

// ======================================================
// ASK GEMINI
// ======================================================

app.post("/api/ask", async (req, res) => {
  const question = String(req.body.question || "").trim();

  const role = String(
    req.body.role || "General Technical Interview"
  ).trim();

  const level = String(
    req.body.level || "Junior"
  ).trim();

  const rawHistory = Array.isArray(req.body.history)
    ? req.body.history
    : [];

  const history: ChatMessage[] = rawHistory
    .filter(
      (m: any) =>
        ["user", "assistant"].includes(m?.role) &&
        typeof m?.content === "string"
    )
    .slice(-8)
    .map((m: any) => ({
      role: m.role,
      content: m.content.slice(0, 4000)
    }));

  if (!question) {
    return res.status(400).json({
      message: "Question is required."
    });
  }

  if (!ai) {
    return res.status(503).json({
      message:
        "Gemini is not configured yet. Paste your API key into backend/.env and restart the backend."
    });
  }

  try {
    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: m.content
          }
        ]
      })),

      {
        role: "user",
        parts: [
          {
            text: question
          }
        ]
      }
    ];

    const response = await ai.models.generateContent({
      model: MODEL,

      contents,

      config: {
        systemInstruction:
          `You are InterviewAI, a concise interview-preparation assistant. ` +
          `The user asks the questions and you answer them. ` +
          `Tailor each answer to a ${level} candidate targeting ${role}. ` +
          `Start with a clear interview-ready answer. ` +
          `Add a short explanation or example when useful, then finish with one practical interview tip. ` +
          `Keep answers focused, accurate, easy to study, and suitable for interview preparation.`,

        maxOutputTokens: 1200,

        temperature: 0.5
      }
    });

    const answer = String(response.text || "").trim();

    return res.json({
      answer:
        answer ||
        "I could not generate an answer. Please try again.",

      provider: "Google Gemini",

      model: MODEL
    });
  } catch (error: any) {
    console.error(
      "Gemini request failed:",
      error?.message || error
    );

    return res.status(500).json({
      message: error?.message
        ? `Gemini request failed: ${error.message}`
        : "The Gemini request failed. Check your API key and try again."
    });
  }
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  console.log(`Gemini model: ${MODEL}`);

  console.log(
    ai
      ? "Gemini API: configured"
      : "Gemini API: waiting for GEMINI_API_KEY in backend/.env"
  );

  console.log(
    JWT_SECRET
      ? "Authentication: configured"
      : "Authentication: waiting for JWT_SECRET in backend/.env"
  );
});
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "./database/connection";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);

const MODEL =
  process.env.OPENROUTER_MODEL || "openrouter/free";

const OPENROUTER_API_KEY =
  (process.env.OPENROUTER_API_KEY || "").trim();

const JWT_SECRET =
  (process.env.JWT_SECRET || "").trim();

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
    provider: "OpenRouter",
    version: "6.0"
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
      aiConfigured: Boolean(OPENROUTER_API_KEY),
      databaseConnected: true,
      provider: "OpenRouter",
      model: MODEL
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      aiConfigured: Boolean(OPENROUTER_API_KEY),
      databaseConnected: false,
      provider: "OpenRouter",
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
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      INSERT INTO users (email, password)
      VALUES ($1, $2)
      RETURNING id, email, created_at
      `,
      [email, hashedPassword]
    );

    const user = result.rows[0];

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

    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

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
// ASK OPENROUTER
// ======================================================

app.post("/api/ask", async (req, res) => {
  if (!JWT_SECRET) {
    return res.status(500).json({
      message: "JWT_SECRET is not configured."
    });
  }

  const bearer = /^Bearer\s+(\S+)$/i.exec(
    (req.get("Authorization") || "").trim()
  );

  if (!bearer) {
    return res.status(401).json({
      message: "A valid Authorization Bearer token is required."
    });
  }

  let userId: string | number;

  try {
    const payload = jwt.verify(bearer[1], JWT_SECRET, {
      algorithms: ["HS256"]
    });

    if (
      typeof payload === "string" ||
      !(
        (typeof payload.userId === "number" &&
          Number.isSafeInteger(payload.userId) &&
          payload.userId > 0) ||
        (typeof payload.userId === "string" &&
          payload.userId.trim().length > 0)
      )
    ) {
      return res.status(401).json({
        message: "Invalid authentication token."
      });
    }

    userId = payload.userId;
  } catch {
    return res.status(401).json({
      message: "Invalid or expired authentication token."
    });
  }

  const suppliedInterviewId = req.body.interviewId;
  let interviewId: string | number | null = null;

  if (suppliedInterviewId !== undefined && suppliedInterviewId !== null) {
    if (
      !(
        (typeof suppliedInterviewId === "number" &&
          Number.isSafeInteger(suppliedInterviewId) &&
          suppliedInterviewId > 0) ||
        (typeof suppliedInterviewId === "string" &&
          suppliedInterviewId.trim().length > 0 &&
          suppliedInterviewId.length <= 128)
      )
    ) {
      return res.status(400).json({
        message: "Invalid interviewId."
      });
    }

    interviewId =
      typeof suppliedInterviewId === "string"
        ? suppliedInterviewId.trim()
        : suppliedInterviewId;
  }

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

  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({
      message:
        "OpenRouter is not configured. Add OPENROUTER_API_KEY to backend/.env and restart the backend."
    });
  }

  try {
    if (interviewId !== null) {
      const existingInterview = await pool.query(
        "SELECT id FROM interviews WHERE id = $1 AND user_id = $2",
        [interviewId, userId]
      );

      if (existingInterview.rows.length === 0) {
        return res.status(404).json({
          message: "Interview not found."
        });
      }

      interviewId = existingInterview.rows[0].id;
    }

    const systemPrompt =
      `You are InterviewAI, a concise interview-preparation assistant. ` +
      `The user asks the questions and you answer them. ` +
      `Tailor each answer to a ${level} candidate targeting ${role}. ` +
      `Start with a clear interview-ready answer. ` +
      `Add a short explanation or example when useful, then finish with one practical interview tip. ` +
      `Keep answers focused, accurate, easy to study, and suitable for interview preparation. ` +
      `Answer in the same language as the user\'s latest question unless the user explicitly asks for another language.`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },

      ...history.map((m) => ({
        role: m.role,
        content: m.content
      })),

      {
        role: "user",
        content: question
      }
    ];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://interviewai-rust.vercel.app", 
          "X-Title": "InterviewAI" 
        }, 
 
        body: JSON.stringify({ 
          model: MODEL, 
          messages, 
          temperature: 0.5, 
          max_tokens: 1200 
        }) 
      } 
    ); 
 
    const data: any = await response.json(); 
 
    if (!response.ok) { 
      console.error( 
        "OpenRouter request failed:", 
        data 
      ); 
 
      return res.status(response.status).json({ 
        message: 
          data?.error?.message || 
          "OpenRouter request failed." 
      }); 
    } 
 
    const answer = String( 
      data?.choices?.[0]?.message?.content || "" 
    ).trim(); 
 
    // Only persist actual generated answers, not the empty-answer fallback.
    if (answer) {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        if (interviewId === null) {
          const createdInterview = await client.query(
            `
            INSERT INTO interviews (user_id, role, topic)
            VALUES ($1, $2, $3)
            RETURNING id
            `,
            [userId, role, Array.from(question).slice(0, 100).join("")]
          );

          interviewId = createdInterview.rows[0].id;
        }

        // Recheck ownership at the write, including after the network request.
        const savedQuestion = await client.query(
          `
          INSERT INTO questions (interview_id, question_text, answer)
          SELECT id, $2, $3
          FROM interviews
          WHERE id = $1 AND user_id = $4
          RETURNING id
          `,
          [interviewId, question, answer, userId]
        );

        if (savedQuestion.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            message: "Interview not found."
          });
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    return res.json({
      interviewId,
      answer: 
        answer || 
        "I could not generate an answer. Please try again.", 
 
      provider: "OpenRouter", 
 
      model: 
        data?.model || 
        MODEL 
    }); 
  } catch (error: any) { 
    console.error( 
      "OpenRouter request failed:", 
      error?.message || error 
    ); 
 
    return res.status(500).json({ 
      message: 
        error?.message || 
        "The OpenRouter request failed. Please try again." 
    }); 
  } 
}); 
 
// ====================================================== 
// START SERVER 
// ====================================================== 
 
app.listen(PORT, () => { 
  console.log(`Server running on ${PORT}`); 
  console.log(`OpenRouter model: ${MODEL}`); 
 
  console.log( 
    OPENROUTER_API_KEY 
      ? "OpenRouter API: configured" 
      : "OpenRouter API: waiting for OPENROUTER_API_KEY in backend/.env" 
  ); 
 
  console.log( 
    JWT_SECRET 
      ? "Authentication: configured" 
      : "Authentication: waiting for JWT_SECRET in backend/.env" 
  ); 
});

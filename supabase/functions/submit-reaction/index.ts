import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max submissions per window per IP

const VALID_EMOTIONS = [
  "happy",
  "sad",
  "angry",
  "disgusted",
  "fearful",
  "surprised",
  "unsure",
];

// In-memory rate limit store (resets on cold start, which is fine for basic protection)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

function isValidScore(val: unknown): boolean {
  return typeof val === "number" && val >= 0 && val <= 1 && isFinite(val);
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limit by IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Parse and validate payload
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const { content_id, session_id, happy, sad, angry, disgusted, fearful, surprised, dominant_emotion, user_confirmed } = body;

  // Validate required fields
  if (typeof content_id !== "string" || content_id.length === 0 || content_id.length > 200) {
    return new Response(JSON.stringify({ error: "Invalid content_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  if (typeof session_id !== "string" || session_id.length === 0 || session_id.length > 200) {
    return new Response(JSON.stringify({ error: "Invalid session_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  if (typeof dominant_emotion !== "string" || !VALID_EMOTIONS.includes(dominant_emotion)) {
    return new Response(JSON.stringify({ error: "Invalid dominant_emotion" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const scores = { happy, sad, angry, disgusted, fearful, surprised };
  for (const [key, val] of Object.entries(scores)) {
    if (!isValidScore(val)) {
      return new Response(JSON.stringify({ error: `Invalid score: ${key}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  }

  if (user_confirmed !== null && user_confirmed !== undefined && typeof user_confirmed !== "boolean") {
    return new Response(JSON.stringify({ error: "Invalid user_confirmed" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Write to Supabase using service role key (server-side only)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.from("reactions").insert({
    content_id,
    session_id,
    happy,
    sad,
    angry,
    disgusted,
    fearful,
    surprised,
    dominant_emotion,
    user_confirmed: user_confirmed ?? null,
  });

  if (error) {
    console.error("Insert failed:", error);
    return new Response(JSON.stringify({ error: "Failed to save reaction" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});

const DEFAULT_KEYWORDS: Record<string, number> = {
  "(viagra|cialis|levitra)": 5,
  "(crypto|bitcoin|solana|invest|profit|roi)": 3,
  "(lottery|won|inheritance|million|beneficiary)": 4,
  "(urgent|action required|verify your account|suspended)": 2,
  "(casino|slots|betting|lotto)": 4,
  "\\b(free|gift card|cash bonus)\\b": 2
};

const SPAM_THRESHOLD = 5;

export async function checkSpamScore(message: any, env: any): Promise<boolean> {
  let spamScore = 0;
  
  // 1. Parse standard envelope data
  const subject = (message.headers.get("subject") || "").toLowerCase();
  const from = (message.headers.get("from") || "").toLowerCase();
  const headerText = `subject: ${subject} | from: ${from}`;

  const domainMatch = from.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const senderDomain = domainMatch ? domainMatch[1] : "";

  // 2. Query mail2telegram's existing D1 database setup if configured 
  // (Leveraging v2.0 D1 storage instead of needing a separate KV namespace)
  if (env.DB && senderDomain) {
    try {
      // Check if domain is explicitly blocked in the standard D1 setup
      const blockedRecord = await env.DB.prepare(
        "SELECT value FROM kv_store WHERE key = ?"
      ).bind(`block_domain:${senderDomain}`).first();
      
      if (blockedRecord) {
        console.log(`[SpamFilter] Blocked by database listing: ${senderDomain}`);
        return true;
      }
    } catch (e) {
      console.error("[SpamFilter] DB check error, bypassing table matching:", e);
    }
  }

  // 3. Dynamic Keyword Mapping Retrieval from DB
  let activeKeywords = DEFAULT_KEYWORDS;
  if (env.DB) {
    try {
      const kvKeywords = await env.DB.prepare(
        "SELECT value FROM kv_store WHERE key = 'CONFIG_SPAM_KEYWORDS'"
      ).bind().first<{ value: string }>();
      
      if (kvKeywords?.value) {
        activeKeywords = JSON.parse(kvKeywords.value);
      }
    } catch (e) {
      console.log("[SpamFilter] Falling back to default keywords list.");
    }
  }

  // 4. Score Aggregation via Regex Patterns
  for (const [pattern, weight] of Object.entries(activeKeywords)) {
    if (new RegExp(pattern, "i").test(headerText)) {
      spamScore += Number(weight);
    }
  }
  
  if (subject && subject === subject.toUpperCase() && /[A-Z]/.test(subject)) {
    spamScore += 2; // Aggressive uppercase capitalization penalty
  }

  // 5. Crytographic Envelope Signatures (SPF/DKIM/DMARC alignment checks)
  const authResults = (message.headers.get("authentication-results") || "").toLowerCase();
  if (authResults) {
    if (authResults.includes("dkim=fail") || authResults.includes("dkim=permerror")) spamScore += 4;
    if (authResults.includes("spf=fail") || authResults.includes("spf=softfail")) spamScore += 3;
    if (authResults.includes("dmarc=fail")) spamScore += 4;
  } else {
    spamScore += 1; // Unsigned email context
  }

  // 6. Header Integrity Profiling
  const messageId = message.headers.get("message-id");
  const xMailer = message.headers.get("x-mailer");
  if (!messageId) spamScore += 3; // Standard MTAs dynamically construct message IDs
  if (xMailer && /(phpmailer|directmail|massmail)/i.test(xMailer)) spamScore += 2;

  console.log(`[SpamFilter] Message Score Evaluation: ${spamScore} / Threshold: ${SPAM_THRESHOLD}`);
  return spamScore >= SPAM_THRESHOLD;
}

/**
 * Custom Mini App Router Interceptor
 * Plugs directly into itty-router handlers for management profiles.
 */
export async function handleSpamApiRoute(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method === "GET") {
    let keywords = DEFAULT_KEYWORDS;
    if (env.DB) {
      const row = await env.DB.prepare("SELECT value FROM kv_store WHERE key = 'CONFIG_SPAM_KEYWORDS'").first<{ value: string }>();
      if (row?.value) keywords = JSON.parse(row.value);
    }
    return new Response(JSON.stringify({ success: true, data: keywords }), { headers: corsHeaders });
  }

  if (request.method === "POST") {
    try {
      const body: any = await request.json();
      if (!body.keywords || typeof body.keywords !== "object") {
        return new Response(JSON.stringify({ success: false, error: "Invalid layout" }), { status: 400, headers: corsHeaders });
      }

      if (env.DB) {
        // Upsert standard mapping configuration directly inside the mail2telegram SQL storage layer
        await env.DB.prepare(
          "INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES ('CONFIG_SPAM_KEYWORDS', ?, datetime('now'))"
        ).bind(JSON.stringify(body.keywords)).run();
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}

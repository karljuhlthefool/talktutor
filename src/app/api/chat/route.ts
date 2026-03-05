import { streamText, UIMessage, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getUser } from "@/lib/auth";
import { NextResponse } from "next/server";

// Allow up to 60 seconds for streaming LLM responses (Vercel serverless function timeout)
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a friendly language tutor helping users practice conversation in their target language.

Guidelines:
- Respond naturally in the language the user is practicing
- Gently correct major mistakes by showing the correct form in parentheses
- Keep the conversation engaging and encourage the user to continue
- If they ask for help, explain grammar or vocabulary clearly
- Adapt to their skill level - start simple, increase complexity as they improve
- Be patient and encouraging`;

export async function POST(req: Request) {
  // 1. Auth check
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse request body
  const { messages }: { messages: UIMessage[] } = await req.json();

  // 3. Validate inputs
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  // 4. Initialize z.ai client (OpenAI-compatible)
  const zai = createOpenAI({
    apiKey: process.env.ZAI_API_KEY,
    baseURL: process.env.ZAI_BASE_URL,
  });

  // 5. Stream response using streamText
  const result = streamText({
    model: zai.chat("glm-4.6"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  // 6. Return streaming response (UI message stream for useChat compatibility)
  return result.toUIMessageStreamResponse();
}

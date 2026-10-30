import {
  DECK_ADVISOR_TOOLS_DECLARATIONS,
  dispatchDeckAdvisorTool,
} from "./deck-advisor-tools";
import type {
  DeckAdvisorDatabase,
  DeckAdvisorRawUserData,
} from "../db/repositories/deck-advisor-repository";

export interface LlmToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: LlmToolCall[];
}

export class LlmHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "LlmHttpError";
  }
}

/**
 * Runs conversation with multi-step tool call loop against OpenAI-compatible completions endpoints.
 */
export async function executeLlmWithToolLoop(
  endpoint: string,
  headers: Record<string, string>,
  bodyParams: { model: string; temperature: number; reasoning_effort?: "low" | "medium" | "high" },
  initialMessages: LlmChatMessage[],
  toolContext: {
    userData: DeckAdvisorRawUserData;
    rulesMcpUrl?: string;
    customFetch: typeof fetch;
    database?: DeckAdvisorDatabase;
    maxToolSteps: number;
  }
): Promise<{ reply: string; toolsConsulted: string[] }> {
  const messages: LlmChatMessage[] = [...initialMessages];
  const toolsConsulted: string[] = [];
  const maxSteps = toolContext.maxToolSteps;

  for (let step = 0; step < maxSteps; step++) {
    const res = await toolContext.customFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...bodyParams,
        messages,
        tools: DECK_ADVISOR_TOOLS_DECLARATIONS,
        tool_choice: "auto",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new LlmHttpError(res.status, `LLM call failed with status ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          role: "assistant";
          content?: string | null;
          tool_calls?: LlmToolCall[];
        };
      }>;
    };
    const choice = json.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error("No message choice returned from LLM");
    }

    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return {
        reply: message.content || "",
        toolsConsulted: Array.from(new Set(toolsConsulted)),
      };
    }

    messages.push(message);

    for (const toolCall of toolCalls) {
      const name = toolCall.function?.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(toolCall.function?.arguments || "{}");
      } catch {
        args = {};
      }

      toolsConsulted.push(name);
      const execution = await dispatchDeckAdvisorTool(name, args, {
        userData: toolContext.userData,
        rulesMcpUrl: toolContext.rulesMcpUrl,
        customFetch: toolContext.customFetch,
        database: toolContext.database,
      });

      messages.push({
        role: "tool",
        name,
        tool_call_id: toolCall.id,
        content:
          typeof execution.result === "string"
            ? execution.result
            : JSON.stringify(execution.result),
      });
    }
  }

  // Final turn if max steps reached without stopping
  const res = await toolContext.customFetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...bodyParams,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new LlmHttpError(res.status, `LLM final turn failed with status ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  };
  return {
    reply: json.choices?.[0]?.message?.content || "",
    toolsConsulted: Array.from(new Set(toolsConsulted)),
  };
}

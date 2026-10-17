import type {
  LLMMessage,
  LLMResponse,
  LLMProvider,
  PromptIntent,
  LLMToolDefinition,
} from "../router-types";

/**
 * Base provider class providing timeout execution and error encapsulation
 */
export abstract class BaseLLMProvider implements LLMProvider {
  abstract id: string;
  abstract name: string;

  abstract isAvailable(keys: Record<string, string>): boolean;
  abstract isPreferredForIntent(intent: PromptIntent): number;
  abstract matchesModel(rawModel: string): boolean;

  abstract call(
    model: string,
    messages: LLMMessage[],
    keys: Record<string, string>,
    systemPrompt?: string,
    tools?: LLMToolDefinition[]
  ): Promise<LLMResponse | null>;

  protected async executeWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await operation(controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  protected handleError(error: unknown, providerName: string): null {
    console.warn(`[Router Provider] ${providerName} execution failed:`, error);
    return null;
  }
}

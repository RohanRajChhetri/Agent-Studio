/**
 * Agent Studio OS — Provider Selection & Strategy Registry
 * 
 * Modular provider architecture:
 * - providers/base-provider.ts: BaseLLMProvider abstract class
 * - providers/gemini-provider.ts: GeminiProvider
 * - providers/openai-provider.ts: OpenAIProvider
 * - providers/groq-provider.ts: GroqProvider
 * - providers/anthropic-provider.ts: AnthropicProvider
 * - providers/omniroute-provider.ts: OmniRouteGatewayProvider & OmnirouteLocalProvider
 */

import { BaseLLMProvider } from "./providers/base-provider";
import { GeminiProvider } from "./providers/gemini-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { GroqProvider } from "./providers/groq-provider";
import { AnthropicProvider } from "./providers/anthropic-provider";
import {
  OmniRouteGatewayProvider,
  OmnirouteLocalProvider,
} from "./providers/omniroute-provider";

export {
  BaseLLMProvider,
  GeminiProvider,
  OpenAIProvider,
  GroqProvider,
  AnthropicProvider,
  OmniRouteGatewayProvider,
  OmnirouteLocalProvider,
};

/** Registry of instantiated providers */
export const ALL_PROVIDERS: BaseLLMProvider[] = [
  new GeminiProvider(),
  new OpenAIProvider(),
  new GroqProvider(),
  new AnthropicProvider(),
  new OmniRouteGatewayProvider(),
  new OmnirouteLocalProvider(),
];

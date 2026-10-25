// The full set of providers the admin can configure — shared by
// validation (which fields are required per category) and the service
// layer (default base_url when the admin leaves it blank). Mirrors
// exactly what llm_provider.py dispatches on; a provider code added here
// with no matching dispatch branch there just falls through to Ollama via
// LLMUnavailable, so the two lists must stay in sync by hand.
export const PROVIDER_CATALOG = {
  // Cloud — API key + model; base_url is fixed by their own SDK.
  gemini: { category: "cloud", label: "Google AI Studio (Gemini)", requiresApiKey: true, defaultBaseUrl: null },
  openai: { category: "cloud", label: "OpenAI (ChatGPT)", requiresApiKey: true, defaultBaseUrl: null },
  anthropic: { category: "cloud", label: "Anthropic (Claude)", requiresApiKey: true, defaultBaseUrl: null },
  mistral: { category: "cloud", label: "Mistral AI", requiresApiKey: true, defaultBaseUrl: "https://api.mistral.ai/v1" },

  // Fast inference — OpenAI-compatible API, API key + base URL + model.
  groq: { category: "fast_inference", label: "Groq", requiresApiKey: true, defaultBaseUrl: "https://api.groq.com/openai/v1" },
  together: { category: "fast_inference", label: "Together AI", requiresApiKey: true, defaultBaseUrl: "https://api.together.xyz/v1" },
  deepseek: { category: "fast_inference", label: "DeepSeek", requiresApiKey: true, defaultBaseUrl: "https://api.deepseek.com" },
  openrouter: { category: "fast_inference", label: "OpenRouter", requiresApiKey: true, defaultBaseUrl: "https://openrouter.ai/api/v1" },

  // Local — base URL + model only, no API key.
  ollama: { category: "local", label: "Ollama", requiresApiKey: false, defaultBaseUrl: "http://localhost:11434/v1" },
  lm_studio: { category: "local", label: "LM Studio", requiresApiKey: false, defaultBaseUrl: "http://localhost:1234/v1" },
  vllm: { category: "local", label: "vLLM", requiresApiKey: false, defaultBaseUrl: null },
};

export const PROVIDER_CODES = Object.keys(PROVIDER_CATALOG);

export const providerRequiresApiKey = (provider) => PROVIDER_CATALOG[provider]?.requiresApiKey ?? true;

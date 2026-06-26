/** Metadata del proveedor Anthropic. La llamada real ocurre en api/ai/generate.js */
export const anthropic = {
  name: "anthropic",
  displayName: "Anthropic",
  model: "claude-sonnet-4-6",
  baseURL: "https://api.anthropic.com/v1",
  serverEnvVar: "ANTHROPIC_API_KEY", // solo en servidor — NUNCA en VITE_
  supportsStreaming: true,
  maxTokensLimit: 8192,
};

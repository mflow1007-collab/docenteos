/** Metadata del proveedor OpenAI. La llamada real ocurre en api/ai/generate.js */
export const openai = {
  name: "openai",
  displayName: "OpenAI",
  model: "gpt-4o",
  baseURL: "https://api.openai.com/v1",
  serverEnvVar: "OPENAI_API_KEY",
  supportsStreaming: true,
  maxTokensLimit: 16384,
};

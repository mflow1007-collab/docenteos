/** Metadata del proveedor Abacus AI. Compatible con API OpenAI. La llamada real ocurre en api/ai/generate.js */
export const abacus = {
  name: "abacus",
  displayName: "Abacus AI",
  model: "route-llm",
  baseURL: "https://routellm.abacus.ai/v1",
  serverEnvVar: "ABACUS_API_KEY",
  supportsStreaming: true,
  maxTokensLimit: 8192,
  compatibleWith: "openai",
};

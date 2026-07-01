/** Metadata del proveedor NVIDIA NIM. Compatible con API OpenAI. La llamada real ocurre en api/ai/generate.js */
export const nvidia = {
  name: "nvidia",
  displayName: "NVIDIA NIM",
  model: "nvidia/llama-3.1-nemotron-70b-instruct",
  baseURL: "https://integrate.api.nvidia.com/v1",
  serverEnvVar: "NVIDIA_API_KEY",
  supportsStreaming: true,
  maxTokensLimit: 32768,
  compatibleWith: "openai",
};

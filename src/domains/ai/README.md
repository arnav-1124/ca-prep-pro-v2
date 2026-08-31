# AI Domain (`src/domains/ai`)

## Purpose
Orchestrates AI services, custom prompt compilation, vector embeddings integration, and provider-independent adapter mappings.

## Boundaries & Constraints
*   **Provider Abstraction**: Domain and service layers must not import AI provider SDKs directly. All calls are routed through an internal `AIProviderInterface` adapter layout.
*   **Supported Adapters**: Initial configuration accommodates `Gemini` and `OpenRouter` adapters. Future adapters must be drop-in extensions without requiring modifications to core domain logic.
*   **Context Control**: Domain logic controls what context (e.g. recent student scores, weak topics) is injected into requests. The AI domain must avoid dumping raw database outputs directly to LLM requests.
*   **Client Separation**: Business prompt templates, system instructions, and provider credentials reside strictly on the server side.

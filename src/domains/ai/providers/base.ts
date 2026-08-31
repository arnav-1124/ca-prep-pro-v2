export interface AIExplanationPayload {
  question: string;
  options: string[];
  selectedOption?: string;
  correctOption: string;
  caseTitle?: string;
  caseScenarioText?: string;
}

export interface AIExplanationResult {
  explanation: string;
  keyPoint: string;
  provider?: string;
  model?: string;
}

export interface AIProvider {
  name: string;
  modelName: string;
  generateExplanation(payload: AIExplanationPayload, abortSignal?: AbortSignal): Promise<AIExplanationResult>;
}

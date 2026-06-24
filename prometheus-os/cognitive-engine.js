import { intelligenceOrchestrator } from "./intelligence-orchestrator.js";

export class CognitiveEngine {
  shouldAnswer(command = "", history = []) {
    return intelligenceOrchestrator.shouldAnswer(command, history);
  }

  answer(message = "", history = []) {
    return intelligenceOrchestrator.answer(message, history);
  }
}

export const cognitiveEngine = new CognitiveEngine();

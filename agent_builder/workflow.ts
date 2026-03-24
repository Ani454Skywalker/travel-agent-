/**
 * Travel / Tripin workflow for OpenAI Agent Builder (@openai/agents).
 *
 * Fixes:
 * - Do not append classifier run items to shared history (stops {"Classification":...} in chat).
 * - Branch on finalOutput.Classification, not on output_text truthiness.
 * - Classifier: reasoning.effort "none" to avoid "Thought for a moment" UI where supported.
 * - tripin_intro agent for "who are you / what is Tripin" style questions.
 *
 * Paste into Agent Builder or keep in repo as source of truth; sync workflow_id if yours differs.
 */
import { webSearchTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { z } from "zod";

const webSearchPreview = webSearchTool({
  searchContextSize: "medium",
  userLocation: { type: "approximate" },
});

const ClassifierSchema = z.object({
  Classification: z.enum(["flight_info", "itinerary", "tripin_intro"]),
});

const classifier = new Agent({
  name: "Classifier",
  instructions: `You only classify the user's message. Output JSON matching the schema; do not chat.

Categories:
- flight_info: flights, routes, airport codes, airlines, tickets, booking-style flight help.
- itinerary: trip planning, day-by-day plans, destinations, activities, hotels, schedules (not flight-only).
- tripin_intro: who are you, what is Tripin, what can you do, how do you work, meta / identity questions.`,
  model: "gpt-5.2-pro",
  outputType: ClassifierSchema,
  modelSettings: {
    store: true,
    reasoning: { effort: "none" },
    text: { verbosity: "low" },
  },
});

const flightAgent = new Agent({
  name: "Flight Agent",
  instructions:
    "You are Tripin’s flight helper. Recommend specific options when possible; use IATA airport codes. Plain language only; never JSON or routing labels.",
  model: "gpt-5-chat-latest",
  tools: [webSearchPreview],
  modelSettings: {
    temperature: 1,
    topP: 1,
    maxTokens: 2048,
    store: true,
    reasoning: { effort: "none" },
  },
});

const itineraryAgent = new Agent({
  name: "Itinerary Agent",
  instructions:
    "You are Tripin’s itinerary helper. Build concise, practical day-by-day plans when asked. Plain language only; never JSON.",
  model: "gpt-5-chat-latest",
  modelSettings: {
    temperature: 1,
    topP: 1,
    maxTokens: 2048,
    store: true,
    reasoning: { effort: "none" },
  },
});

const tripinIntroAgent = new Agent({
  name: "Tripin Intro",
  instructions: `You are Tripin, the travel and itinerary assistant inside this app. Answer in first person.

Explain briefly what you help with: planning trips, itineraries, destinations, activities, and practical travel questions.

Rules:
- Never say you were created by, built by, or made by OpenAI, ChatGPT, or any vendor.
- Never print JSON, labels like "Classification", or chain-of-thought.
- Be warm and clear; invite them to say where they want to go or what they need.`,
  model: "gpt-5-chat-latest",
  modelSettings: {
    temperature: 0.7,
    topP: 1,
    maxTokens: 1024,
    store: true,
    reasoning: { effort: "none" },
  },
});

type WorkflowInput = { input_as_text: string };

export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace("Travel Agent", async () => {
    const userMessage: AgentInputItem = {
      role: "user",
      content: [{ type: "input_text", text: workflow.input_as_text }],
    };

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_699c90e53cb4819090583cc1a9bc1fe40cf6e2c51e70909c",
      },
    });

    const classifierRun = await runner.run(classifier, [userMessage]);
    const decision = classifierRun.finalOutput;
    if (!decision) {
      throw new Error("Classifier result is undefined");
    }

    // Important: do NOT push classifierRun.newItems into history — that surfaces
    // structured JSON ("Classification") in the user-visible thread.

    const runVisibleAgent = async (agent: Agent) => {
      const result = await runner.run(agent, [userMessage]);
      if (result.finalOutput === undefined || result.finalOutput === null) {
        throw new Error("Agent result is undefined");
      }
      return typeof result.finalOutput === "string"
        ? result.finalOutput
        : String(result.finalOutput);
    };

    let output_text: string;
    switch (decision.Classification) {
      case "flight_info":
        output_text = await runVisibleAgent(flightAgent);
        break;
      case "itinerary":
        output_text = await runVisibleAgent(itineraryAgent);
        break;
      case "tripin_intro":
        output_text = await runVisibleAgent(tripinIntroAgent);
        break;
      default: {
        const _exhaustive: never = decision.Classification;
        throw new Error(`Unhandled classification: ${_exhaustive}`);
      }
    }

    return { output_text };
  });
};

import { z } from "zod";

// Business config used to inject into your templates
export const BusinessConfigSchema = z.object({
  version: z.literal(1),
  bizName: z.string().min(2).max(80),
  receptionistName: z.string().min(2).max(40),
  timezone: z.string().min(3).max(60),
  calendarId: z.string().min(3).max(200),
  email: z.string().email()
});

// Text-to-speech payload
export const TTSRequestSchema = z.object({
  text: z.string().min(1).max(1000),
  voice_id: z.string().min(1).max(64).optional(),
  model_id: z.string().min(1).max(64).optional(),
  voice_settings: z.record(z.any()).optional()
});

// Generate flows input
export const GenerateFlowsSchema = z.object({
  cfg: BusinessConfigSchema
});

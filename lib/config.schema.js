import { z } from "zod";

export const BusinessConfigSchema = z.object({
  version: z.literal(1),
  bizName: z.string().min(2).max(80),
  receptionistName: z.string().min(2).max(40),
  timezone: z.string().min(3).max(60),
  calendarId: z.string().min(3).max(200),
  email: z.string().email()
});

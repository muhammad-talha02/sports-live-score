import { z } from 'zod';

// List commentary query schema
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Create commentary schema
export const createCommentarySchema = z.object({
  minute: z.coerce.number().int().nonnegative(),
  sequence: z.coerce.number().int().nonnegative(),
  period: z.string().min(1, 'Period is required'),
  eventType: z.string().min(1, 'Event type is required'),
  actor: z.string().min(1, 'Actor is required'),
  team: z.string().min(1, 'Team is required'),
  message: z.string().min(1, 'Message is required'),
  metadata: z.record(z.string(),z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

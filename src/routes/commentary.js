import { Router } from "express";
import {
  listCommentaryQuerySchema,
  createCommentarySchema,
} from "../validation/commentary.js";
import { matchIdParamSchema } from "../validation/matches.js";
import { db } from "../db/db.js";
import { commentary, matches } from "../db/schema.js";
import { desc, eq } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

// GET all commentary for a specific match
commentaryRouter.get("/", async (req, res) => {
  const paramsParsed = matchIdParamSchema.safeParse(req.params);

  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid params", details: paramsParsed.error.issues });
  }

  const queryParsed = listCommentaryQuerySchema.safeParse(req.query);

  if (!queryParsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid query", details: queryParsed.error.issues });
  }

  const limit = Math.min(queryParsed.data.limit ?? 100, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, paramsParsed.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return res.status(200).json({ data });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to list commentary", details: error });
  }
});

// POST new commentary for a specific match
commentaryRouter.post("/", async (req, res) => {
  const paramsParsed = matchIdParamSchema.safeParse(req.params);

  if (!paramsParsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid commentary params", details: paramsParsed.error.issues });
  }

  const bodyParsed = createCommentarySchema.safeParse(req.body);

  if (!bodyParsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid commentary payload", details: bodyParsed.error.issues });
  }

  try {
    // Verify the match exists
    const matchExists = await db
      .select()
      .from(matches)
      .where(eq(matches.id, paramsParsed.data.id))
      .limit(1);

    if (matchExists.length === 0) {
      return res.status(404).json({ error: "Match not found" });
    }

    const [event] = await db
      .insert(commentary)
      .values({
        ...bodyParsed.data,
        matchId: paramsParsed.data.id,
      })
      .returning();

    return res.status(201).json({ data: event });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to create commentary", details: error });
  }
});
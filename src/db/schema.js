import { pgTable, serial, text, timestamp, integer, jsonb, varchar, foreignKey, pgEnum } from 'drizzle-orm/pg-core';

// Define the match_status enum
export const matchStatus = pgEnum('match_status', ['scheduled', 'live', 'finished']);

// Define the matches table
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  sport: text('sport').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  status: matchStatus('status').notNull().default('scheduled'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  homeScore: integer('home_score').notNull().default(0),
  awayScore: integer('away_score').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Define the commentary table
export const commentary = pgTable('commentary', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  minute: integer('minute').notNull(),
  sequence: integer('sequence').notNull(),
  period: varchar('period').notNull(),
  eventType: varchar('event_type').notNull(),
  actor: text('actor').notNull(),
  team: varchar('team').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  tags: text('tags').array(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

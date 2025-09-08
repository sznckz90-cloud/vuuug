import { pgTable, serial, text, timestamp, integer, decimal, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegram_id: text('telegram_id').unique().notNull(), // Changed from telegramId
  username: text('username'),
  first_name: text('first_name'),
  last_name: text('last_name'),
  language_code: text('language_code'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const earnings = pgTable('earnings', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description').notNull(),
  date: timestamp('date').defaultNow(),
  created_at: timestamp('created_at').defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  date: timestamp('date').defaultNow(),
  created_at: timestamp('created_at').defaultNow(),
});

export const budgets = pgTable('budgets', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id).notNull(),
  category: text('category').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  period: text('period').notNull(), // 'weekly', 'monthly', 'yearly'
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  target_amount: decimal('target_amount', { precision: 10, scale: 2 }).notNull(),
  current_amount: decimal('current_amount', { precision: 10, scale: 2 }).default('0'),
  target_date: timestamp('target_date'),
  completed: boolean('completed').default(false),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Earning = typeof earnings.$inferSelect;
export type NewEarning = typeof earnings.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Relative import (not "@/lib/types") so drizzle-kit can bundle the schema
// without tsconfig path-alias resolution.
import type { SiteSettings, StatRow } from "../types";

// ── Enums ───────────────────────────────────────────────────────────────────
export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"]);

// ── Users (global identity; credentials provider, JWT sessions) ──────────────
// Identity tables (users/organizations/memberships/invitations) are the shared
// SSO contract — kept identical to the other Studio 61 apps so the CRM handoff
// can JIT-provision via external_id.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  // Nullable: SSO-provisioned users (from the CRM handoff) have no password.
  passwordHash: text("password_hash"),
  // Links a user to its CRM user id (null for locally-created staff users).
  externalId: text("external_id").unique(),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// ── Organizations (tenants) ──────────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // Links an org to a CRM company id (null for locally-created orgs).
  externalId: text("external_id").unique(),
  // Super-admin control: whether this customer may create new sites.
  canAddSites: boolean("can_add_sites").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// ── Memberships (users ↔ organizations, many-to-many) ────────────────────────
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("memberships_org_user_uniq").on(t.orgId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

// ── Invitations (join an org via a shareable token link) ─────────────────────
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: orgRoleEnum("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("invitations_org_idx").on(t.orgId)],
);

// ── Sites (a tracked website; orgId is the tenant boundary) ──────────────────
// Raw analytics events do NOT live in Postgres — they're written to Cloudflare
// Analytics Engine by the edge collector, keyed by `trackingId`. This table
// only holds the small per-site config the dashboard needs.
export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // The customer's website hostname, e.g. "example.com" (no scheme).
    domain: text("domain").notNull(),
    // Public id embedded in the tracking snippet and used as the Analytics
    // Engine index (index1). Globally unique, opaque, regenerable.
    trackingId: text("tracking_id").notNull().unique(),
    settings: jsonb("settings").$type<SiteSettings>().notNull().default({}),
    // "Reset views": when set, the dashboard only counts events on/after this
    // time. Analytics Engine is append-only, so this hides prior data rather
    // than deleting it (old rows age out of AE within ~90 days anyway).
    statsResetAt: timestamp("stats_reset_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("sites_org_id_idx").on(t.orgId)],
);

// ── Daily rollups (long-term history beyond Analytics Engine's ~90 days) ─────
// Populated by a daily cron that aggregates the previous day from Analytics
// Engine. One compact row per site per day. The dashboard reads recent ranges
// live from AE and older ranges from here.
export const statsDaily = pgTable(
  "stats_daily",
  {
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    pageviews: integer("pageviews").notNull().default(0),
    visitors: integer("visitors").notNull().default(0),
    topPages: jsonb("top_pages").$type<StatRow[]>().notNull().default([]),
    topReferrers: jsonb("top_referrers").$type<StatRow[]>().notNull().default([]),
    topCountries: jsonb("top_countries").$type<StatRow[]>().notNull().default([]),
    byDevice: jsonb("by_device").$type<StatRow[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.day] })],
);

// ── Relations ─────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  invitations: many(invitations),
  sites: many(sites),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.orgId],
    references: [organizations.id],
  }),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sites.orgId],
    references: [organizations.id],
  }),
  stats: many(statsDaily),
}));

export const statsDailyRelations = relations(statsDaily, ({ one }) => ({
  site: one(sites, {
    fields: [statsDaily.siteId],
    references: [sites.id],
  }),
}));

// ── Inferred types ────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
export type OrgRole = (typeof orgRoleEnum.enumValues)[number];
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type StatsDaily = typeof statsDaily.$inferSelect;
export type NewStatsDaily = typeof statsDaily.$inferInsert;

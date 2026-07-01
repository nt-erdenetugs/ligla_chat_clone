import { pgTable, varchar, uniqueIndex, index, uuid, timestamp, integer, foreignKey, text, boolean, jsonb, pgSchema, check, bigint, unique, json, doublePrecision, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const conditionoperator = pgEnum("conditionoperator", ['EQUAL', 'NOT_EQUAL', 'INCLUDE', 'NOT_INCLUDE', 'REGEX', 'NULL', 'NOT_NULL', 'GT', 'LT', 'GTE', 'LTE', 'VALUES_MATCH_ANY', 'VALUES_DO_NOT_MATCH_ANY'])

export const contenttype = pgEnum("contenttype", ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'LOCATION', 'STICKER'])

export const logicaloperator = pgEnum("logicaloperator", ['AND', 'OR'])

export const userstatus = pgEnum("userstatus", ['ACTIVE', 'INACTIVE', 'PENDING', 'LOCKED'])

export const valuetype = pgEnum("valuetype", ['STRING', 'NUMBER', 'ARRAY', 'BOOLEAN', 'DATETIME'])


export const hypervisorUser = pgTable("hypervisorUser", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar().notNull(),
	hashedPassword: varchar().notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	uniqueIndex("hypervisorUser_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ix_hypervisorUser_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
]);
export const auth = pgTable("auth", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationName: varchar(),
	email: varchar().notNull(),
	hashedPassword: varchar().notNull(),
	status: userstatus().default('ACTIVE').notNull(),
	mailSentAt: timestamp({ withTimezone: true, mode: 'date' }),
	loginAttempts: integer().default(0).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("auth_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ix_auth_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	index("ix_auth_organization_name").using("btree", table.organizationName.asc().nullsLast().op("text_ops")),
]);
export const userPasswordResetToken = pgTable("userPasswordResetToken", {
	userId: uuid().primaryKey().notNull(),
	token: varchar().notNull(),
	expiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [auth.id],
			name: "fk_userPasswordResetToken_userId"
		}),
]);
export const organization = pgTable("organization", {
	name: varchar().primaryKey().notNull(),
	displayName: varchar().notNull(),
	description: text(),
	maxOperator: integer().default(50),
	isActive: boolean().default(true).notNull(),
	archivedBy: varchar(),
	createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	apiKey: varchar().notNull(),
	id: uuid().defaultRandom().notNull(),
	liffId: varchar(),
	loginLiffId: varchar(),
	fileUploadLiffId: varchar(),
}, (table) => [
	uniqueIndex("ix_organization_id").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("organization_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);
export const organizationMigration = pgTable("organizationMigration", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationName: varchar(),
	schemaName: varchar(),
	currentPhase: varchar({ length: 20 }).default('NOT_STARTED').notNull(),
	schemaCreatedAt: timestamp({ withTimezone: true, mode: 'date' }),
	dataCopiedAt: timestamp({ withTimezone: true, mode: 'date' }),
	migrationCompletedAt: timestamp({ withTimezone: true, mode: 'date' }),
	lastRevision: varchar(),
	lastStatus: varchar(),
	lastError: text(),
	details: jsonb(),
	startedAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
	finishedAt: timestamp({ withTimezone: true, mode: 'date' }),
	updatedAt: timestamp({ withTimezone: true, mode: 'date' }),
}, (table) => [
	uniqueIndex("ix_organizationMigration_schemaName_unique").using("btree", table.schemaName.asc().nullsLast().op("text_ops")).where(sql`("schemaName" IS NOT NULL)`),
	index("ix_public_organizationMigration_organizationName").using("btree", table.organizationName.asc().nullsLast().op("text_ops")),
	index("ix_public_organizationMigration_schemaName").using("btree", table.schemaName.asc().nullsLast().op("text_ops")),
]);

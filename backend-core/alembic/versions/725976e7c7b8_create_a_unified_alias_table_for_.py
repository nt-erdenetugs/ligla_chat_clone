"""create a unified alias table for organizations

Revision ID: 725976e7c7b8
Revises: c5225a05942b
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers
revision = '725976e7c7b8'
down_revision = 'c5225a05942b'

def get_managed_columns():
    """Returns the full list of category, number, and datetime columns."""
    return (
        [f"category{i}" for i in range(1, 26)] +
        [f"number{i}" for i in range(1, 16)] +
        [f"datetime{i}" for i in range(1, 16)]
    )

def upgrade():
    # 1. Create the new unified table
    op.create_table(
        'organizationSettings',
        sa.Column('organizationName', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('memberFeedSurveyColumnSettings', JSONB, nullable=False, server_default='{}'),
        sa.Column('createdAt', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updatedAt', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        sa.Column('syncedAt', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('organizationName', 'type'),
        sa.ForeignKeyConstraint(['organizationName'], ['organization.name'], ondelete='CASCADE'),
        sa.CheckConstraint("type IN ('memberFeed', 'survey')", name='type_check')
    )

    # 2. Remove the old triggers and functions
    op.execute('DROP TRIGGER IF EXISTS trigger_create_organization_column_aliases ON organization;')
    op.execute('DROP FUNCTION IF EXISTS create_organization_column_aliases();')

    # 3. Data Migration (Upgrade)
    all_cols = get_managed_columns()

    def get_upgrade_sql(type_key: str, alias_tbl: str, settings_tbl: str):
        # VALUES construct avoids PostgreSQL's 100-argument limit for jsonb_build_object
        rows = ", ".join([f"('{c}', a.\"{c}\")" for c in all_cols])
        return f"""
            INSERT INTO "organizationSettings"
                ("organizationName", "type", "memberFeedSurveyColumnSettings", "createdAt")
            SELECT
                a."organizationName",
                '{type_key}',
                (
                    SELECT jsonb_object_agg(key, jsonb_build_object(
                        'alias', val,
                        'isEnabled', (s."enabledColumns" IS NULL OR key = ANY(string_to_array(s."enabledColumns", ',')))
                    ))
                    FROM (VALUES {rows}) AS t(key, val)
                ),
                a."createdAt"
            FROM "{alias_tbl}" a
            LEFT JOIN "{settings_tbl}" s ON a."organizationName" = s."organizationName";
        """

    op.execute(get_upgrade_sql('memberFeed', 'organizationMemberFeedColumnAlias', 'organizationMemberFeedSetting'))
    op.execute(get_upgrade_sql('survey', 'organizationSurveyColumnAlias', 'organizationSurveySetting'))

    # 4. Drop old tables
    for tbl in ['organizationMemberFeedSetting', 'organizationMemberFeedColumnAlias',
                'organizationSurveySetting', 'organizationSurveyColumnAlias']:
        op.drop_table(tbl)

def downgrade():
    all_cols = get_managed_columns()

    # 1. Recreate old tables using loops
    def create_alias_table(name: str):
        cols = [sa.Column('organizationName', sa.String(), primary_key=True)]
        cols += [sa.Column(c, sa.String(), server_default=c) for c in all_cols]
        cols += [sa.Column('createdAt', sa.DateTime(timezone=True), server_default=sa.func.now()),
                 sa.Column('updatedAt', sa.DateTime(timezone=True))]
        op.create_table(name, *cols, sa.ForeignKeyConstraint(['organizationName'], ['organization.name']))

    create_alias_table('organizationMemberFeedColumnAlias')
    create_alias_table('organizationSurveyColumnAlias')

    op.create_table('organizationMemberFeedSetting',
        sa.Column('organizationName', sa.String(), primary_key=True),
        sa.Column('enabledColumns', sa.String()),
        sa.ForeignKeyConstraint(['organizationName'], ['organization.name']))

    op.create_table('organizationSurveySetting',
        sa.Column('organizationName', sa.String(), primary_key=True),
        sa.Column('enabledColumns', sa.String()),
        sa.Column('createdAt', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['organizationName'], ['organization.name']))

    # 2. Data Migration (Downgrade)
    for t_type in ['memberFeed', 'survey']:
        prefix = f"organization{t_type[0].upper()}{t_type[1:]}"
        alias_tbl = f"{prefix}ColumnAlias"
        set_tbl = f"{prefix}Setting"

        # Move Aliases back
        alias_selects = ", ".join([f"\"memberFeedSurveyColumnSettings\"->'{c}'->>'alias'" for c in all_cols])
        alias_cols = ", ".join([f"\"{c}\"" for c in all_cols])

        op.execute(f"""
            INSERT INTO "{alias_tbl}" ("organizationName", {alias_cols}, "createdAt")
            SELECT "organizationName", {alias_selects}, "createdAt"
            FROM "organizationSettings" WHERE type = '{t_type}';
        """)

        # Move Settings back (FIX: Uses jsonb_each to reconstruct the CSV string safely)
        op.execute(f"""
            INSERT INTO "{set_tbl}" ("organizationName", "enabledColumns")
            SELECT "organizationName", (
                SELECT string_agg(key, ',')
                FROM jsonb_each("memberFeedSurveyColumnSettings")
                WHERE (value->>'isEnabled')::boolean IS TRUE
            )
            FROM "organizationSettings" WHERE type = '{t_type}';
        """)

    # 3. Restore original triggers and functions
    op.execute("""
        CREATE OR REPLACE FUNCTION create_organization_column_aliases()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO "organizationMemberFeedColumnAlias" ("organizationName", "createdAt")
            VALUES (NEW.name, NOW())
            ON CONFLICT ("organizationName") DO NOTHING;

            INSERT INTO "organizationSurveyColumnAlias" ("organizationName", "createdAt")
            VALUES (NEW.name, NOW())
            ON CONFLICT ("organizationName") DO NOTHING;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trigger_create_organization_column_aliases
        AFTER INSERT ON organization
        FOR EACH ROW
        EXECUTE FUNCTION create_organization_column_aliases();
    """)

    # 4. Drop unified table
    op.drop_table('organizationSettings')

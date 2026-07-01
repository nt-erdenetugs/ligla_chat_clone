"""seed memberFeed and survey column alias data

Revision ID: 14b334e49155
Revises: b0bed3deab2d
Create Date: 2025-10-30 20:41:56.916710

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "14b334e49155"
down_revision = "b0bed3deab2d"
branch_labels = None
depends_on = None

def upgrade():
    # Get connection
    connection = op.get_bind()

    # Fetch all organizations
    organizations = connection.execute(sa.text("SELECT name FROM organization")).fetchall()

    # Seed organizationMemberFeedColumnAlias for each organization
    for org in organizations:
        org_name = org[0]

        # Check if member feed column alias already exists
        existing_member_feed = connection.execute(
            sa.text('SELECT 1 FROM "organizationMemberFeedColumnAlias" WHERE "organizationName" = :org_name'),
            {"org_name": org_name},
        ).fetchone()

        if not existing_member_feed:
            connection.execute(
                sa.text(
                    'INSERT INTO "organizationMemberFeedColumnAlias" ("organizationName", "createdAt") '
                    "VALUES (:org_name, NOW())"
                ),
                {"org_name": org_name},
            )
            print(f"Created organizationMemberFeedColumnAlias for organization: {org_name}")

        # Check if survey column alias already exists
        existing_survey = connection.execute(
            sa.text('SELECT 1 FROM "organizationSurveyColumnAlias" WHERE "organizationName" = :org_name'),
            {"org_name": org_name},
        ).fetchone()

        if not existing_survey:
            connection.execute(
                sa.text(
                    'INSERT INTO "organizationSurveyColumnAlias" ("organizationName", "createdAt") '
                    "VALUES (:org_name, NOW())"
                ),
                {"org_name": org_name},
            )
            print(f"Created organizationSurveyColumnAlias for organization: {org_name}")

    # Create trigger function that automatically creates memberFeed and survey column alias records
    op.execute(
        """
        CREATE OR REPLACE FUNCTION create_organization_column_aliases()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Insert organizationMemberFeedColumnAlias record
            INSERT INTO "organizationMemberFeedColumnAlias" ("organizationName", "createdAt")
            VALUES (NEW.name, NOW())
            ON CONFLICT ("organizationName") DO NOTHING;

            -- Insert organizationSurveyColumnAlias record
            INSERT INTO "organizationSurveyColumnAlias" ("organizationName", "createdAt")
            VALUES (NEW.name, NOW())
            ON CONFLICT ("organizationName") DO NOTHING;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Create trigger that fires after organization insert
    op.execute(
        """
        CREATE TRIGGER trigger_create_organization_column_aliases
        AFTER INSERT ON organization
        FOR EACH ROW
        EXECUTE FUNCTION create_organization_column_aliases();
        """
    )

def downgrade():
    # Drop trigger first
    op.execute('DROP TRIGGER IF EXISTS trigger_create_organization_column_aliases ON organization;')

    # Drop trigger function
    op.execute('DROP FUNCTION IF EXISTS create_organization_column_aliases();')

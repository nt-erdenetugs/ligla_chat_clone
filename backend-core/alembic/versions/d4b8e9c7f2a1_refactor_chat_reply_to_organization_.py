"""refactor chat reply to organization settings

Revision ID: d4b8e9c7f2a1
Revises: 725976e7c7b8
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers
revision = 'd4b8e9c7f2a1'
down_revision = '725976e7c7b8'


def upgrade():
    conn = op.get_bind()

    # Step 0: Add chatReplySettings column to organizationSettings
    op.add_column(
        'organizationSettings',
        sa.Column('chatReplySettings', JSONB(), nullable=True)
    )

    # Step 1: Pre-migration validation
    validation_sql = """
    DO $$
    DECLARE
        orphaned_count INTEGER;
        org_settings_count INTEGER;
        user_settings_count INTEGER;
    BEGIN
        -- Check for orphaned records
        SELECT COUNT(*) INTO orphaned_count
        FROM "chatReplySetting" crs
        WHERE crs.id NOT IN (
            SELECT "chatReplySettingId" FROM "organizationChatReplySetting"
            UNION
            SELECT "chatReplySettingId" FROM "userChatReplySetting"
        );

        IF orphaned_count > 0 THEN
            RAISE WARNING 'Found % orphaned chatReplySetting records', orphaned_count;
        END IF;

        -- Count organization settings to migrate
        SELECT COUNT(*) INTO org_settings_count
        FROM "chatReplySetting" crs
        INNER JOIN "organizationChatReplySetting" ocrs ON ocrs."chatReplySettingId" = crs.id;

        -- Count user settings (will be dropped)
        SELECT COUNT(*) INTO user_settings_count
        FROM "chatReplySetting" crs
        INNER JOIN "userChatReplySetting" ucrs ON ucrs."chatReplySettingId" = crs.id;

        RAISE NOTICE 'Migrating % organization-level settings', org_settings_count;
        IF user_settings_count > 0 THEN
            RAISE WARNING 'Dropping % user-level settings (user-level support removed)', user_settings_count;
        END IF;
    END $$;
    """
    conn.execute(sa.text(validation_sql))

    # Step 2: Allow chatReply type during migration
    op.execute("ALTER TABLE \"organizationSettings\" DROP CONSTRAINT IF EXISTS type_check")
    op.create_check_constraint(
        'type_check',
        'organizationSettings',
        "type IN ('memberFeed', 'survey', 'chatReply')"
    )

    # Step 3: Transform data from 8 tables into JSON (organization-level only)
    upgrade_sql = """
    INSERT INTO "organizationSettings"
        ("organizationName", "type", "chatReplySettings", "createdAt")
    SELECT
        ocrs."organizationName",
        'chatReply',
        jsonb_build_object(
            'isActive', crs."isActive",
            'updatedBy', crs."updatedBy",
            'schedules', (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'scheduleType', s."scheduleType",
                        'timeRanges', (
                            SELECT COALESCE(jsonb_agg(
                                jsonb_build_object(
                                    'startTime', tr."startTime",
                                    'endTime', tr."endTime",
                                    'timeRangeType', tr."timeRangeType"
                                )
                            ), '[]'::jsonb)
                            FROM "chatReplyScheduleTimeRange" tr
                            WHERE tr."scheduleId" = s.id
                        ),
                        'customDates', (
                            SELECT COALESCE(
                                jsonb_agg(to_char(cd."date" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
                                '[]'::jsonb
                            )
                            FROM "chatReplyScheduleCustomDate" cd
                            WHERE cd."scheduleId" = s.id
                        )
                    )
                ), '[]'::jsonb)
                FROM "chatReplySchedule" s
                WHERE s."chatReplySettingId" = crs.id
            ),
            'messages', (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'timeRangeType', csm."timeRangeType",
                        'templateId', csm."replyMessageTemplateId"::text
                    )
                ), '[]'::jsonb)
                FROM "chatReplySettingMessage" csm
                WHERE csm."chatReplySettingId" = crs.id
            )
        ),
        crs."createdAt"
    FROM "chatReplySetting" crs
    INNER JOIN "organizationChatReplySetting" ocrs
        ON ocrs."chatReplySettingId" = crs.id;
    """
    conn.execute(sa.text(upgrade_sql))

    # Step 4: Post-migration validation - CHECK JSON structure
    validation_check_sql = """
    DO $$
    DECLARE
        invalid_record RECORD;
        is_valid BOOLEAN;
        total_migrated INTEGER;
    BEGIN
        SELECT COUNT(*) INTO total_migrated
        FROM "organizationSettings"
        WHERE type = 'chatReply';

        RAISE NOTICE 'Migrated % chatReply records to organizationSettings', total_migrated;

        FOR invalid_record IN
            SELECT "organizationName", "chatReplySettings"
            FROM "organizationSettings"
            WHERE type = 'chatReply'
        LOOP
            is_valid := TRUE;

            -- Check required keys exist
            IF NOT (invalid_record."chatReplySettings" ? 'isActive'
                AND invalid_record."chatReplySettings" ? 'schedules'
                AND invalid_record."chatReplySettings" ? 'messages') THEN
                RAISE EXCEPTION 'Missing required keys for organizationName: %', invalid_record."organizationName";
            END IF;

            -- Check data types
            IF jsonb_typeof(invalid_record."chatReplySettings"->'isActive') != 'boolean' THEN
                RAISE EXCEPTION 'Invalid isActive type for organizationName: %', invalid_record."organizationName";
            END IF;

            IF jsonb_typeof(invalid_record."chatReplySettings"->'schedules') != 'array' THEN
                RAISE EXCEPTION 'Invalid schedules type for organizationName: %', invalid_record."organizationName";
            END IF;

            IF jsonb_typeof(invalid_record."chatReplySettings"->'messages') != 'array' THEN
                RAISE EXCEPTION 'Invalid messages type for organizationName: %', invalid_record."organizationName";
            END IF;
        END LOOP;

        RAISE NOTICE 'All chatReply JSON structures validated successfully';
    END $$;
    """
    conn.execute(sa.text(validation_check_sql))

    # Step 5: CHECK constraint already updated before insert

    # Step 5: Drop old tables in dependency order
    op.drop_table('chatReplyScheduleCustomDate')
    op.drop_table('chatReplyScheduleTimeRange')
    op.drop_table('chatReplySchedule')
    op.drop_table('chatReplySettingMessage')
    op.drop_table('userChatReplySetting')
    op.drop_table('organizationChatReplySetting')
    op.drop_table('chatReplySetting')

    # Step 6: Drop enum types
    sa.Enum(name='chatreplyscheduletype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='chatreplytimerangetype').drop(op.get_bind(), checkfirst=True)

    # chatReplyMessageTemplate table is kept


def downgrade():
    conn = op.get_bind()

    # 1. Drop and recreate enum types (ensures they exist with correct values)
    # Drop if they exist
    conn.execute(sa.text("DROP TYPE IF EXISTS chatreplyscheduletype CASCADE"))
    conn.execute(sa.text("DROP TYPE IF EXISTS chatreplytimerangetype CASCADE"))

    # Create enum types if missing
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatreplyscheduletype') THEN
                CREATE TYPE chatreplyscheduletype AS ENUM (
                    'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', 'HOLIDAYS', 'CUSTOM_DATE'
                );
            END IF;
        END $$;
    """))

    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chatreplytimerangetype') THEN
                CREATE TYPE chatreplytimerangetype AS ENUM ('ACTIVE_TIME', 'DEFAULT');
            END IF;
        END $$;
    """))

    # Create SQLAlchemy enum objects (don't create in DB, just reference existing types)
    schedule_type_enum = postgresql.ENUM(
        'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', 'HOLIDAYS', 'CUSTOM_DATE',
        name='chatreplyscheduletype',
        create_type=False
    )
    time_range_type_enum = postgresql.ENUM(
        'ACTIVE_TIME', 'DEFAULT',
        name='chatreplytimerangetype',
        create_type=False
    )

    # 2. Recreate old tables
    op.create_table(
        'chatReplySetting',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('isActive', sa.Boolean(), nullable=False),
        sa.Column('updatedBy', sa.String(), nullable=True),
        sa.Column('createdAt', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updatedAt', sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        'organizationChatReplySetting',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('organizationName', sa.String(), nullable=False, unique=True),
        sa.Column('chatReplySettingId', UUID(as_uuid=True), nullable=False, unique=True),
        sa.ForeignKeyConstraint(['organizationName'], ['organization.name'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['chatReplySettingId'], ['chatReplySetting.id'], ondelete='CASCADE')
    )

    op.create_table(
        'userChatReplySetting',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('userId', UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('chatReplySettingId', UUID(as_uuid=True), nullable=False, unique=True),
        sa.ForeignKeyConstraint(['userId'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['chatReplySettingId'], ['chatReplySetting.id'], ondelete='CASCADE')
    )

    op.create_table(
        'chatReplySchedule',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('chatReplySettingId', UUID(as_uuid=True), nullable=False),
        sa.Column('scheduleType', schedule_type_enum, nullable=False),
        sa.ForeignKeyConstraint(['chatReplySettingId'], ['chatReplySetting.id'], ondelete='CASCADE')
    )

    op.create_table(
        'chatReplyScheduleTimeRange',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('scheduleId', UUID(as_uuid=True), nullable=False),
        sa.Column('startTime', sa.String(), nullable=False),
        sa.Column('endTime', sa.String(), nullable=False),
        sa.Column('timeRangeType', time_range_type_enum, nullable=False),
        sa.ForeignKeyConstraint(['scheduleId'], ['chatReplySchedule.id'], ondelete='CASCADE')
    )

    op.create_table(
        'chatReplyScheduleCustomDate',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('scheduleId', UUID(as_uuid=True), nullable=False),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['scheduleId'], ['chatReplySchedule.id'], ondelete='CASCADE')
    )

    op.create_table(
        'chatReplySettingMessage',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('chatReplySettingId', UUID(as_uuid=True), nullable=False),
        sa.Column('replyMessageTemplateId', UUID(as_uuid=True), nullable=False),
        sa.Column('timeRangeType', time_range_type_enum, nullable=False),
        sa.ForeignKeyConstraint(['chatReplySettingId'], ['chatReplySetting.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['replyMessageTemplateId'], ['chatReplyMessageTemplate.id'], ondelete='CASCADE')
    )

    # 3. Extract data from JSON back to tables
    # Extract chatReplySetting and organizationChatReplySetting
    # First insert into chatReplySetting and get the IDs back
    extract_chat_reply_setting_sql = """
    WITH settings_data AS (
        SELECT
            "organizationName",
            gen_random_uuid() as setting_id,
            ("chatReplySettings"->>'isActive')::boolean as "isActive",
            "chatReplySettings"->>'updatedBy' as "updatedBy",
            "createdAt"
        FROM "organizationSettings"
        WHERE type = 'chatReply'
    ),
    inserted_settings AS (
        INSERT INTO "chatReplySetting" (id, "isActive", "updatedBy", "createdAt")
        SELECT setting_id, "isActive", "updatedBy", "createdAt"
        FROM settings_data
        RETURNING id
    )
    INSERT INTO "organizationChatReplySetting" (id, "organizationName", "chatReplySettingId")
    SELECT
        gen_random_uuid(),
        sd."organizationName",
        sd.setting_id
    FROM settings_data sd;
    """
    conn.execute(sa.text(extract_chat_reply_setting_sql))

    # Extract schedules
    extract_schedules_sql = """
    WITH schedules_data AS (
        SELECT
            ocrs."chatReplySettingId",
            (schedule->>'scheduleType')::chatreplyscheduletype as schedule_type
        FROM "organizationSettings" os
        INNER JOIN "organizationChatReplySetting" ocrs ON ocrs."organizationName" = os."organizationName"
        CROSS JOIN LATERAL jsonb_array_elements(os."chatReplySettings"->'schedules') AS schedule
        WHERE os.type = 'chatReply'
    )
    INSERT INTO "chatReplySchedule" (id, "chatReplySettingId", "scheduleType")
    SELECT
        gen_random_uuid(),
        "chatReplySettingId",
        schedule_type
    FROM schedules_data;
    """
    conn.execute(sa.text(extract_schedules_sql))

    # Extract time ranges (match by chatReplySettingId + scheduleType)
    extract_time_ranges_sql = """
    WITH schedules_from_json AS (
        SELECT
            ocrs."chatReplySettingId",
            (schedule->>'scheduleType')::chatreplyscheduletype as schedule_type,
            schedule
        FROM "organizationSettings" os
        INNER JOIN "organizationChatReplySetting" ocrs ON ocrs."organizationName" = os."organizationName"
        CROSS JOIN LATERAL jsonb_array_elements(os."chatReplySettings"->'schedules') AS schedule
        WHERE os.type = 'chatReply'
    )
    INSERT INTO "chatReplyScheduleTimeRange" (id, "scheduleId", "startTime", "endTime", "timeRangeType")
    SELECT
        gen_random_uuid(),
        crs.id,
        time_range->>'startTime',
        time_range->>'endTime',
        (time_range->>'timeRangeType')::chatreplytimerangetype
    FROM schedules_from_json sfj
    INNER JOIN "chatReplySchedule" crs
        ON crs."chatReplySettingId" = sfj."chatReplySettingId"
        AND crs."scheduleType" = sfj.schedule_type
    CROSS JOIN LATERAL jsonb_array_elements(sfj.schedule->'timeRanges') AS time_range
    WHERE jsonb_array_length(sfj.schedule->'timeRanges') > 0;
    """
    conn.execute(sa.text(extract_time_ranges_sql))

    # Extract custom dates (match by chatReplySettingId + scheduleType)
    extract_custom_dates_sql = """
    WITH schedules_from_json AS (
        SELECT
            ocrs."chatReplySettingId",
            (schedule->>'scheduleType')::chatreplyscheduletype as schedule_type,
            schedule
        FROM "organizationSettings" os
        INNER JOIN "organizationChatReplySetting" ocrs ON ocrs."organizationName" = os."organizationName"
        CROSS JOIN LATERAL jsonb_array_elements(os."chatReplySettings"->'schedules') AS schedule
        WHERE os.type = 'chatReply'
    )
    INSERT INTO "chatReplyScheduleCustomDate" (id, "scheduleId", "date")
    SELECT
        gen_random_uuid(),
        crs.id,
        (custom_date#>>'{}')::timestamp with time zone
    FROM schedules_from_json sfj
    INNER JOIN "chatReplySchedule" crs
        ON crs."chatReplySettingId" = sfj."chatReplySettingId"
        AND crs."scheduleType" = sfj.schedule_type
    CROSS JOIN LATERAL jsonb_array_elements(sfj.schedule->'customDates') AS custom_date
    WHERE sfj.schedule ? 'customDates' AND jsonb_array_length(sfj.schedule->'customDates') > 0;
    """
    conn.execute(sa.text(extract_custom_dates_sql))

    # Extract messages
    extract_messages_sql = """
    WITH messages AS (
        SELECT
            ocrs."chatReplySettingId",
            message
        FROM "organizationSettings" os
        INNER JOIN "organizationChatReplySetting" ocrs ON ocrs."organizationName" = os."organizationName"
        CROSS JOIN LATERAL jsonb_array_elements(os."chatReplySettings"->'messages') AS message
        WHERE os.type = 'chatReply'
    )
    INSERT INTO "chatReplySettingMessage" (id, "chatReplySettingId", "replyMessageTemplateId", "timeRangeType")
    SELECT
        gen_random_uuid(),
        "chatReplySettingId",
        (message->>'templateId')::uuid,
        (message->>'timeRangeType')::chatreplytimerangetype
    FROM messages;
    """
    conn.execute(sa.text(extract_messages_sql))

    # 4. Delete chatReply records from organizationSettings FIRST
    conn.execute(sa.text("DELETE FROM \"organizationSettings\" WHERE type = 'chatReply'"))

    # 5. Drop chatReplySettings column
    op.drop_column('organizationSettings', 'chatReplySettings')

    # 6. Restore CHECK constraint (must be last, after deleting chatReply records)
    op.execute("ALTER TABLE \"organizationSettings\" DROP CONSTRAINT IF EXISTS type_check")
    op.create_check_constraint(
        'type_check',
        'organizationSettings',
        "type IN ('memberFeed', 'survey')"
    )

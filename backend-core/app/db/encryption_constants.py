from sqlalchemy import text

CHAT_MESSAGE_SEARCH_INDEX = "idx_chat_message_search_text_bigm"
CHAT_MESSAGE_SEARCH_LOCK_KEY = 12800677

NOTE_SEARCH_INDEX = "idx_note_search_text_bigm"
NOTE_SEARCH_LOCK_KEY = 12800678

CHAT_ATTRIBUTE_VALUE_SEARCH_INDEX = "idx_chat_attribute_value_search_text_bigm"
CHAT_ATTRIBUTE_VALUE_SEARCH_LOCK_KEY = 12800679

CHAT_ATTRIBUTE_VALUE_PLAIN_SEARCH_INDEX = "idx_chat_attribute_value_search_text_bigm_plain"
CHAT_ATTRIBUTE_VALUE_PLAIN_SEARCH_LOCK_KEY = 12800680

_DECRYPT_SQL = "public.pgp_sym_decrypt(content, pg_catalog.current_setting('app.organizationKey', true)::text)"


def _build_encrypted_search_function_sql(function_name: str, body_sql: str) -> str:
    """Build a STRICT IMMUTABLE plpgsql search-text function with fail-closed exception handling.

    body_sql must be a complete plpgsql block (DECLARE/BEGIN/...) that returns text.
    """
    return f"""
    CREATE OR REPLACE FUNCTION public.{function_name}(content bytea)
    RETURNS text
    LANGUAGE plpgsql
    IMMUTABLE
    STRICT
    AS $$
    {body_sql}
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END;
    $$;
"""


_TEXT_FIELD_BODY = f"""
    DECLARE
        payload jsonb;
    BEGIN
        payload := {_DECRYPT_SQL}::jsonb;
        RETURN NULLIF(
            lower(COALESCE(payload->>'text', payload->>'altText', '')),
            ''
        );
"""

_LOWERED_PLAINTEXT_BODY = f"""
    BEGIN
        RETURN NULLIF(lower({_DECRYPT_SQL}), '');
"""

CHAT_MESSAGE_SEARCH_FUNCTION_SQL = _build_encrypted_search_function_sql("chat_message_search_text", _TEXT_FIELD_BODY)

NOTE_SEARCH_FUNCTION_SQL = _build_encrypted_search_function_sql("note_search_text", _LOWERED_PLAINTEXT_BODY)

CHAT_ATTRIBUTE_VALUE_SEARCH_FUNCTION_SQL = _build_encrypted_search_function_sql(
    "chat_attribute_value_search_text", _LOWERED_PLAINTEXT_BODY
)

CHAT_ATTRIBUTE_VALUE_PLAIN_SEARCH_FUNCTION_SQL = """
    CREATE OR REPLACE FUNCTION public.chat_attribute_value_search_text_plain(content bytea)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    STRICT
    AS $$
        SELECT lower(convert_from(content, 'UTF8'));
    $$;
"""

SET_ORG_KEY_SQL = text("SELECT set_config('app.organizationKey', CAST(:organization_key AS text), true)")

# Session-scoped variant (is_local = false): the value persists across statements on
# the same connection. Required for CREATE INDEX CONCURRENTLY, which runs on an
# AUTOCOMMIT connection where a transaction-local setting would not survive.
SET_ORG_KEY_SESSION_SQL = text("SELECT set_config('app.organizationKey', CAST(:organization_key AS text), false)")

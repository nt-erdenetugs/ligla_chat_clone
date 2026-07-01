from app.common.utils import uuid_to_schema_name


def test_compute_schema_name_is_stable() -> None:
    org_id = "550e8400-e29b-41d4-a716-446655440000"
    assert uuid_to_schema_name(org_id) == "org_550e8400e29b41d4a716446655440000"


def test_compute_schema_name_is_lowercase() -> None:
    org_id = "550E8400-E29B-41D4-A716-446655440000"
    assert uuid_to_schema_name(org_id) == "org_550e8400e29b41d4a716446655440000"

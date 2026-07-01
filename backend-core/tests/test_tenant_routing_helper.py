from app.db.tenant_context import (
    clear_tenant_schema,
    is_tenant_routed,
    set_tenant_schema,
    should_apply_organization_filter,
)


def test_should_apply_organization_filter_defaults_to_true_when_not_routed() -> None:
    clear_tenant_schema()

    assert is_tenant_routed() is False
    assert should_apply_organization_filter() is True


def test_should_apply_organization_filter_is_false_when_routed() -> None:
    set_tenant_schema("org_test")

    assert is_tenant_routed() is True
    assert should_apply_organization_filter() is False

    clear_tenant_schema()

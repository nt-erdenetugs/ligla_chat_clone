from unittest.mock import MagicMock

import pytest
from sqlalchemy.engine import Engine

from jobs.tenant_manager.manager import Organization, SchemaDataOperation, TenantManager
from jobs.tenant_manager.operations.encryption import EncryptionResult
from jobs.tenant_manager.operations.search_index import SearchIndexResult
from jobs.tenant_manager.utils import calculate_performance_metrics, validate_worker_count


@pytest.fixture
def mock_engine():
    """Create a mock engine for testing."""
    engine = MagicMock(spec=Engine)
    pool = MagicMock()
    pool.size.return_value = 10
    pool.max_overflow = 5
    pool.max_connections = 15
    engine.pool = pool
    return engine


@pytest.fixture
def mock_organizations():
    """Create mock organizations for testing."""
    return [
        Organization(id="org-1-uuid", name="Org 1", schema_name="org_1234567890abcdef1234567890abcdef1"),
        Organization(id="org-2-uuid", name="Org 2", schema_name="org_1234567890abcdef1234567890abcdef2"),
        Organization(id="org-3-uuid", name="Org 3", schema_name="org_1234567890abcdef1234567890abcdef3"),
        Organization(id="org-4-uuid", name="Org 4", schema_name="org_1234567890abcdef1234567890abcdef4"),
    ]


class TestParallelExecution:
    """Test parallel execution functionality."""

    def test_sequential_execution_single_worker(self, mock_engine, mock_organizations):
        """Test that single worker executes sequentially."""
        manager = TenantManager(mock_engine)

        # Mock the get_all_organizations method
        manager.get_all_organizations = MagicMock(return_value=mock_organizations)

        # Mock the migration method to simulate successful migration
        manager._migrate_single_org_to_tenant = MagicMock(
            side_effect=lambda org, source, dry_run: (org.name, {"table1": 100}, 1.0)
        )

        results = manager.migrate_all_to_tenant_schemas(max_workers=1, dry_run=True)

        # Verify all organizations were processed
        assert len(results) == 4
        assert "Org 1" in results
        assert "Org 2" in results
        assert "Org 3" in results
        assert "Org 4" in results

        # Verify sequential execution (method called for each org)
        assert manager._migrate_single_org_to_tenant.call_count == 4

    def test_parallel_execution_multiple_workers(self, mock_engine, mock_organizations):
        """Test that multiple workers execute in parallel."""
        manager = TenantManager(mock_engine)

        # Mock the get_all_organizations method
        manager.get_all_organizations = MagicMock(return_value=mock_organizations)

        # Mock the migration method to simulate successful migration
        manager._migrate_single_org_to_tenant = MagicMock(
            side_effect=lambda org, source, dry_run: (org.name, {"table1": 100}, 0.5)
        )

        results = manager.migrate_all_to_tenant_schemas(max_workers=4, dry_run=True)

        # Verify all organizations were processed
        assert len(results) == 4
        assert "Org 1" in results
        assert "Org 2" in results
        assert "Org 3" in results
        assert "Org 4" in results

        # Verify parallel execution (method called for each org)
        assert manager._migrate_single_org_to_tenant.call_count == 4

    def test_parallel_execution_with_error_continue_on_error(self, mock_engine, mock_organizations):
        """Test parallel execution with errors and continue-on-error mode."""
        manager = TenantManager(mock_engine)

        # Mock the get_all_organizations method
        manager.get_all_organizations = MagicMock(return_value=mock_organizations)

        # Mock the migration method to simulate errors for some orgs
        def mock_migrate(org, source, dry_run):
            if org.name == "Org 2":
                return (org.name, {"error": -1}, 0.5)
            return (org.name, {"table1": 100}, 0.5)

        manager._migrate_single_org_to_tenant = MagicMock(side_effect=mock_migrate)

        results = manager.migrate_all_to_tenant_schemas(max_workers=4, dry_run=True, continue_on_error=True)

        # Verify all organizations were processed
        assert len(results) == 4

        # Verify error was captured but execution continued
        assert "error" in results["Org 2"]
        assert "error" not in results["Org 1"]
        assert "error" not in results["Org 3"]
        assert "error" not in results["Org 4"]

    def test_parallel_execution_with_error_fail_fast(self, mock_engine, mock_organizations):
        """Test parallel execution with errors and fail-fast mode."""
        manager = TenantManager(mock_engine)

        # Mock the get_all_organizations method
        manager.get_all_organizations = MagicMock(return_value=mock_organizations)

        # Mock the migration method to simulate errors for some orgs
        def mock_migrate(org, source, dry_run):
            if org.name == "Org 2":
                return (org.name, {"error": -1}, 0.5)
            return (org.name, {"table1": 100}, 0.5)

        manager._migrate_single_org_to_tenant = MagicMock(side_effect=mock_migrate)

        results = manager.migrate_all_to_tenant_schemas(
            max_workers=4,
            dry_run=True,
            continue_on_error=False,  # Default behavior
        )

        # Should still process all organizations (cancelling futures happens after first error)
        # but some might not complete due to cancellation
        assert len(results) >= 1  # At least the first org should be processed


class TestSchemaDataOperations:
    """Test shared tenant data operation helpers."""

    def test_process_single_org_uses_operation_metadata(self, mock_engine, capsys):
        """Test custom operation labels work without hardcoded dispatch."""
        manager = TenantManager(mock_engine)
        org = Organization(id="org-1-uuid", name="Org 1", schema_name="org_1234567890abcdef1234567890abcdef1")
        encryption_service = MagicMock()
        operation_results = {
            "chatMessage": EncryptionResult(
                table="chatMessage",
                total_rows=3,
                processed_count=2,
                error_count=0,
            )
        }
        operation = SchemaDataOperation(
            label="masking",
            infinitive="mask",
            past_tense="masked",
            summary_label="MASKING",
            data_fn=MagicMock(return_value=operation_results),
        )

        manager.validate_schema_name = MagicMock(return_value=True)
        manager.get_existing_tenant_schemas = MagicMock(return_value=[org.schema_name])

        org_name, results, elapsed = manager._process_single_org(org, encryption_service, 100, False, operation)

        assert org_name == org.name
        assert results == operation_results
        assert elapsed >= 0.0
        operation.data_fn.assert_called_once_with(
            engine=mock_engine,
            org_id=org.id,
            org_name=org.name,
            schema=org.schema_name,
            encryption_service=encryption_service,
            batch_size=100,
            dry_run=False,
        )

        output = capsys.readouterr().out
        assert "Starting masking" in output
        assert "2/3 masked" in output
        assert "Completed: 2 masked, 0 errors" in output

    def test_process_all_schemas_uses_operation_summary_metadata(self, mock_engine, mock_organizations, capsys):
        """Test summary output relies on operation metadata."""
        manager = TenantManager(mock_engine)
        org = mock_organizations[0]
        org_results = {
            "chatMessage": EncryptionResult(
                table="chatMessage",
                total_rows=3,
                processed_count=2,
                error_count=1,
            )
        }
        operation = SchemaDataOperation(
            label="masking",
            infinitive="mask",
            past_tense="masked",
            summary_label="MASKING",
            data_fn=MagicMock(),
        )

        manager.get_all_organizations = MagicMock(return_value=[org])
        manager._process_single_org = MagicMock(return_value=(org.name, org_results, 0.2))

        results = manager._process_all_schemas(
            encryption_service=MagicMock(),
            dry_run=False,
            max_workers=1,
            batch_size=100,
            continue_on_error=False,
            operation=operation,
        )

        assert results == {org.name: org_results}

        output = capsys.readouterr().out
        assert "Starting masking for 1 organizations" in output
        assert "MASKING Summary:" in output
        assert "Total rows masked: 2" in output
        assert "Total row errors: 1" in output


class TestWorkerValidation:
    """Test worker count validation."""

    def test_validate_worker_count_within_limits(self, mock_engine):
        """Test worker count validation within connection pool limits."""
        # Request 4 workers with pool size 10 + 5 overflow = 15 max
        workers = validate_worker_count(mock_engine, 4)
        assert workers == 4  # Should be unchanged

    def test_validate_worker_count_exceeds_limits(self, mock_engine):
        """Test worker count validation when exceeding limits."""
        # Request 14 workers with pool size 10 + 5 overflow = 15 max
        # Should be limited to 13 (max - 2 reserved)
        workers = validate_worker_count(mock_engine, 14)
        assert workers == 13

    def test_validate_worker_count_minimum(self, mock_engine):
        """Test worker count validation minimum value."""
        # Request 0 workers should return 1
        workers = validate_worker_count(mock_engine, 0)
        assert workers == 1


class TestPerformanceMetrics:
    """Test performance metrics calculation."""

    def test_calculate_performance_metrics_empty(self):
        """Test performance metrics with empty timings."""
        metrics = calculate_performance_metrics({})
        assert metrics["total"] == 0.0
        assert metrics["average"] == 0.0
        assert metrics["speedup"] == 1.0

    def test_calculate_performance_metrics_single_org(self):
        """Test performance metrics with single organization."""
        timings = {"Org 1": 10.0}
        metrics = calculate_performance_metrics(timings)
        assert metrics["total"] == 10.0
        assert metrics["average"] == 10.0
        assert metrics["min"] == 10.0
        assert metrics["max"] == 10.0
        assert metrics["speedup"] == 1.0  # No parallelization with 1 org

    def test_calculate_performance_metrics_multiple_orgs(self):
        """Test performance metrics with multiple organizations."""
        timings = {"Org 1": 5.0, "Org 2": 8.0, "Org 3": 6.0, "Org 4": 7.0}
        metrics = calculate_performance_metrics(timings)
        assert metrics["total"] == 26.0
        assert metrics["average"] == 6.5
        assert metrics["min"] == 5.0
        assert metrics["max"] == 8.0
        assert metrics["speedup"] > 1.0  # Should show speedup with parallel execution


class TestRollbackParallelExecution:
    """Test parallel rollback execution."""

    def test_rollback_sequential_execution(self, mock_engine, mock_organizations):
        """Test rollback with single worker."""
        manager = TenantManager(mock_engine)

        # Mock the get_all_organizations method
        manager.get_all_organizations = MagicMock(return_value=mock_organizations)

        # Mock the rollback method to simulate successful rollback
        manager._migrate_single_org_from_tenant = MagicMock(
            side_effect=lambda org, target, dry_run, strict: (org.name, {"table1": (100, 100)}, 1.0)
        )

        results = manager.migrate_all_back_to_public(max_workers=1, dry_run=True)

        # Verify all organizations were processed
        assert len(results) == 4
        assert "Org 1" in results
        assert "Org 2" in results
        assert "Org 3" in results
        assert "Org 4" in results

    def test_rollback_parallel_execution(self, mock_engine, mock_organizations):
        """Test rollback with multiple workers."""
        manager = TenantManager(mock_engine)

        # Mock the get_all_organizations method
        manager.get_all_organizations = MagicMock(return_value=mock_organizations)

        # Mock the rollback method to simulate successful rollback
        manager._migrate_single_org_from_tenant = MagicMock(
            side_effect=lambda org, target, dry_run, strict: (org.name, {"table1": (100, 100)}, 0.5)
        )

        results = manager.migrate_all_back_to_public(max_workers=4, dry_run=True)

        # Verify all organizations were processed
        assert len(results) == 4
        assert "Org 1" in results
        assert "Org 2" in results
        assert "Org 3" in results
        assert "Org 4" in results


class TestIntegrationScenarios:
    """Test integration scenarios."""

    def test_mixed_success_and_error_scenarios(self, mock_engine, mock_organizations):
        """Test mixed success and error scenarios."""
        manager = TenantManager(mock_engine)

        # Mock the get_all_organizations method
        manager.get_all_organizations = MagicMock(return_value=mock_organizations)

        # Simulate mixed results
        def mock_migrate(org, source, dry_run):
            if org.name == "Org 2":
                return (org.name, {"error": -1}, 0.5)  # Error
            elif org.name == "Org 4":
                return (org.name, {"error": -1}, 0.3)  # Error
            return (org.name, {"table1": 100}, 0.4)  # Success

        manager._migrate_single_org_to_tenant = MagicMock(side_effect=mock_migrate)

        results = manager.migrate_all_to_tenant_schemas(max_workers=4, dry_run=True, continue_on_error=True)

        # Verify all organizations were processed
        assert len(results) == 4

        # Verify mixed results
        assert "error" not in results["Org 1"]
        assert "error" in results["Org 2"]
        assert "error" not in results["Org 3"]
        assert "error" in results["Org 4"]


class TestChatSearchIndexExecution:
    def test_chat_search_index_sequential_execution(self, mock_engine, mock_organizations):
        manager = TenantManager(mock_engine)
        manager.get_all_organizations = MagicMock(return_value=mock_organizations)
        manager._create_chat_search_index_single_org = MagicMock(
            side_effect=lambda org, encryption_service, dry_run: (
                org.name,
                [
                    SearchIndexResult(
                        schema=org.schema_name,
                        index_name="idx_chat_message_search_text_bigm",
                        encrypted_row_count=10,
                        created=not dry_run,
                        already_exists=False,
                        table="chatMessage",
                    )
                ],
                0.5,
            )
        )

        results = manager.create_chat_search_indexes(
            encryption_service=MagicMock(),
            dry_run=True,
            max_workers=1,
        )

        assert len(results) == 4
        assert manager._create_chat_search_index_single_org.call_count == 4

    def test_chat_search_index_parallel_continue_on_error(self, mock_engine, mock_organizations):
        mock_engine.pool._max_overflow = 5
        manager = TenantManager(mock_engine)
        manager.get_all_organizations = MagicMock(return_value=mock_organizations)

        def mock_create(org, encryption_service, dry_run):
            if org.name == "Org 2":
                return (
                    org.name,
                    [
                        SearchIndexResult(
                            schema=org.schema_name,
                            index_name="idx_chat_message_search_text_bigm",
                            encrypted_row_count=0,
                            created=False,
                            already_exists=False,
                            error="boom",
                            table="chatMessage",
                        )
                    ],
                    0.2,
                )
            return (
                org.name,
                [
                    SearchIndexResult(
                        schema=org.schema_name,
                        index_name="idx_chat_message_search_text_bigm",
                        encrypted_row_count=5,
                        created=True,
                        already_exists=False,
                        table="chatMessage",
                    )
                ],
                0.2,
            )

        manager._create_chat_search_index_single_org = MagicMock(side_effect=mock_create)

        results = manager.create_chat_search_indexes(
            encryption_service=MagicMock(),
            dry_run=False,
            max_workers=4,
            continue_on_error=True,
        )

        assert len(results) == 4
        assert results["Org 2:chatMessage"].error == "boom"
        assert results["Org 1:chatMessage"].created is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

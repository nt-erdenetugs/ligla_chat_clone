import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add the backend-core directory to the path
backend_core_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_core_path))

from jobs.tenant_manager.create_chat_search_indexes import main as create_chat_search_indexes_main
from jobs.tenant_manager.manager import TenantManager
from jobs.tenant_manager.migrate_data import main as migrate_data_main
from jobs.tenant_manager.migrate_data_back import main as migrate_data_back_main
from jobs.tenant_manager.utils import validate_worker_count


class TestCLIArguments:
    """Test CLI argument parsing and validation."""

    def test_migrate_data_cli_workers_argument(self):
        """Test that migrate_data accepts --workers argument."""
        test_args = ["migrate_data", "--source", "public_old", "--commit", "--workers", "4"]

        with patch.object(sys, "argv", test_args):
            with patch("jobs.tenant_manager.migrate_data.get_engine_for_parallel_operations") as mock_get_engine:
                with patch("jobs.tenant_manager.migrate_data.TenantManager") as mock_manager_class:
                    mock_engine = MagicMock()
                    mock_get_engine.return_value = mock_engine

                    mock_manager = MagicMock()
                    mock_manager.migrate_all_to_tenant_schemas.return_value = {"Org 1": {"table1": 100}}
                    mock_manager_class.return_value = mock_manager

                    result = migrate_data_main()

                    # Verify the manager was called with correct arguments
                    mock_manager.migrate_all_to_tenant_schemas.assert_called_once_with(
                        source_schema="public_old",
                        dry_run=False,  # --commit means not dry_run
                        max_workers=4,
                        continue_on_error=False,
                    )
                    assert result == 0  # Success

    def test_migrate_data_cli_continue_on_error(self):
        """Test that migrate_data accepts --continue-on-error argument."""
        test_args = ["migrate_data", "--source", "public_old", "--commit", "--workers", "2", "--continue-on-error"]

        with patch.object(sys, "argv", test_args):
            with patch("jobs.tenant_manager.migrate_data.get_engine_for_parallel_operations") as mock_get_engine:
                with patch("jobs.tenant_manager.migrate_data.TenantManager") as mock_manager_class:
                    mock_engine = MagicMock()
                    mock_get_engine.return_value = mock_engine

                    mock_manager = MagicMock()
                    mock_manager.migrate_all_to_tenant_schemas.return_value = {"Org 1": {"table1": 100}}
                    mock_manager_class.return_value = mock_manager

                    result = migrate_data_main()

                    # Verify the manager was called with continue_on_error=True
                    mock_manager.migrate_all_to_tenant_schemas.assert_called_once_with(
                        source_schema="public_old", dry_run=False, max_workers=2, continue_on_error=True
                    )
                    assert result == 0  # Success

    def test_migrate_data_back_cli_workers_argument(self):
        """Test that migrate_data_back accepts --workers argument."""
        test_args = ["migrate_data_back", "--target", "public_old", "--commit", "--workers", "4", "--strict-counts"]

        with patch.object(sys, "argv", test_args):
            with patch("jobs.tenant_manager.migrate_data_back.get_engine_for_parallel_operations") as mock_get_engine:
                with patch("jobs.tenant_manager.migrate_data_back.TenantManager") as mock_manager_class:
                    mock_engine = MagicMock()
                    mock_get_engine.return_value = mock_engine

                    mock_manager = MagicMock()
                    mock_manager.migrate_all_back_to_public.return_value = {"Org 1": {"table1": (100, 100)}}
                    mock_manager_class.return_value = mock_manager

                    result = migrate_data_back_main()

                    # Verify the manager was called with correct arguments
                    mock_manager.migrate_all_back_to_public.assert_called_once_with(
                        target_schema="public_old",
                        dry_run=False,  # --commit means not dry_run
                        strict_counts=True,
                        max_workers=4,
                        continue_on_error=False,
                    )
                    assert result == 0  # Success

    def test_default_behavior_backwards_compatibility(self):
        """Test that default behavior (no workers specified) is sequential."""
        test_args = ["migrate_data", "--source", "public_old", "--commit"]

        with patch.object(sys, "argv", test_args):
            with patch("jobs.tenant_manager.migrate_data.get_engine_for_parallel_operations") as mock_get_engine:
                with patch("jobs.tenant_manager.migrate_data.TenantManager") as mock_manager_class:
                    mock_engine = MagicMock()
                    mock_get_engine.return_value = mock_engine

                    mock_manager = MagicMock()
                    mock_manager.migrate_all_to_tenant_schemas.return_value = {"Org 1": {"table1": 100}}
                    mock_manager_class.return_value = mock_manager

                    result = migrate_data_main()

                    # Verify default max_workers=1 (sequential)
                    mock_manager.migrate_all_to_tenant_schemas.assert_called_once_with(
                        source_schema="public_old",
                        dry_run=False,
                        max_workers=1,  # Default value
                        continue_on_error=False,
                    )
                    assert result == 0  # Success

    def test_create_chat_search_indexes_cli_workers_argument(self):
        """Test that create_chat_search_indexes accepts worker and commit arguments."""
        test_args = ["create_chat_search_indexes", "--commit", "--workers", "3", "--continue-on-error"]

        with patch.object(sys, "argv", test_args):
            with patch(
                "jobs.tenant_manager.create_chat_search_indexes.get_engine_for_parallel_operations"
            ) as mock_get_engine:
                with patch("jobs.tenant_manager.create_chat_search_indexes.TenantManager") as mock_manager_class:
                    with patch("jobs.tenant_manager.create_chat_search_indexes.EncryptionService"):
                        with patch("jobs.tenant_manager.create_chat_search_indexes.ensure_environment"):
                            mock_engine = MagicMock()
                            mock_get_engine.return_value = mock_engine

                            mock_manager = MagicMock()
                            mock_manager.create_chat_search_indexes.return_value = {"Org 1": MagicMock(is_success=True)}
                            mock_manager_class.return_value = mock_manager

                            result = create_chat_search_indexes_main()

                            mock_manager.create_chat_search_indexes.assert_called_once()
                            called_kwargs = mock_manager.create_chat_search_indexes.call_args.kwargs
                            assert called_kwargs["dry_run"] is False
                            assert called_kwargs["max_workers"] == 3
                            assert called_kwargs["continue_on_error"] is True
                            assert called_kwargs["encryption_service"] is not None
                            assert result == 0


class TestWorkerCountValidation:
    """Test worker count validation logic."""

    def test_validate_worker_count_within_pool_limits(self):
        """Test worker count validation within pool limits."""
        mock_engine = MagicMock()
        mock_engine.pool.size.return_value = 10
        mock_engine.pool.max_overflow = 5

        # Request 4 workers should be allowed
        result = validate_worker_count(mock_engine, 4)
        assert result == 4

    def test_validate_worker_count_exceeds_pool_limits(self):
        """Test worker count validation when exceeding pool limits."""
        mock_engine = MagicMock()
        mock_engine.pool.size.return_value = 5
        mock_engine.pool.max_overflow = 2

        # Request 10 workers should be limited to 5 (7 total - 2 reserved)
        result = validate_worker_count(mock_engine, 10)
        assert result == 5

    def test_validate_worker_count_minimum_one(self):
        """Test worker count validation minimum is 1."""
        mock_engine = MagicMock()
        mock_engine.pool.size.return_value = 10
        mock_engine.pool.max_overflow = 5

        # Request 0 workers should return 1
        result = validate_worker_count(mock_engine, 0)
        assert result == 1


class TestPerformanceComparison:
    """Test performance comparison between sequential and parallel execution."""

    def test_sequential_vs_parallel_timing(self):
        """Compare timing between sequential and parallel execution."""
        # This is a simulated test - in real scenarios you'd run against actual database

        mock_engine = MagicMock()
        mock_engine.pool.size.return_value = 10
        mock_engine.pool.max_overflow = 5

        manager = TenantManager(mock_engine)

        # Mock organizations
        mock_orgs = [
            MagicMock(id="org-1", name="Org 1", schema_name="org_1"),
            MagicMock(id="org-2", name="Org 2", schema_name="org_2"),
            MagicMock(id="org-3", name="Org 3", schema_name="org_3"),
            MagicMock(id="org-4", name="Org 4", schema_name="org_4"),
        ]
        manager.get_all_organizations = MagicMock(return_value=mock_orgs)

        # Mock migration to take 1 second per org
        def mock_migrate(org, source, dry_run):
            return (org.name, {"table1": 100}, 1.0)

        manager._migrate_single_org_to_tenant = MagicMock(side_effect=mock_migrate)

        # Test sequential execution
        import time

        start = time.time()
        results_seq = manager.migrate_all_to_tenant_schemas(max_workers=1, dry_run=True)
        seq_time = time.time() - start

        # Test parallel execution
        start = time.time()
        results_par = manager.migrate_all_to_tenant_schemas(max_workers=4, dry_run=True)
        par_time = time.time() - start

        # Both should process all organizations
        assert len(results_seq) == 4
        assert len(results_par) == 4

        # Parallel should be faster (though in this mock test, the difference is minimal)
        # In real scenarios with actual database operations, parallel would be significantly faster
        assert par_time < seq_time * 0.9  # At least 10% improvement


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

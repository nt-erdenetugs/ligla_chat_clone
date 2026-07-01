"""Pytest configuration and fixtures for backend-core tests."""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from dotenv import load_dotenv

# Ensure imports like `import app.*` and `import jobs.*` work when running
# tests directly from the repo checkout (without installing the wheel).
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Load .env file from secret/.env (relative to project root)
# This must happen BEFORE any app imports that initialize Settings
_project_root = Path(__file__).parent.parent.parent  # Go up from tests/ to project root
_env_file = _project_root / "secret" / ".env"

if _env_file.exists():
    # Load environment variables from secret/.env
    load_dotenv(_env_file, override=False)
else:
    raise FileNotFoundError(f"Environment file not found: {_env_file}")


@pytest.fixture(scope="session", autouse=True)
def mock_gcp_secret_manager():
    """Mock GCP Secret Manager to prevent real GCP calls during tests.

    Tests run with ENV=local so access_secret_version() is never called,
    but this mock acts as a safety net if ENV is changed.
    """
    with patch("app.config.settings.access_secret_version") as mock_secret:
        mock_secret.side_effect = Exception("Mock: No GCP credentials in tests")
        yield mock_secret

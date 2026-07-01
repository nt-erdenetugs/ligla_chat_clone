# Backend-Core Tests

## Running Tests

### Prerequisites

- Python 3.13+ (uv will manage the environment)
- All dependencies installed using `uv` (e.g., `uv sync`)
- Environment variables configured (via `secret/.env` or `conftest.py`)

### Basic Commands

```bash
# From backend-core directory
uv run pytest tests/

# Run specific test file
uv run pytest tests/services/receiver/test_chat_assignment_helper.py

# Run specific test class
uv run pytest tests/services/receiver/test_chat_assignment_helper.py::TestClassName

# Run specific test method
uv run pytest tests/services/receiver/test_chat_assignment_helper.py::TestClassName::test_method_name
```

### Verbose Output

```bash
# Verbose output (shows each test)
uv run pytest tests/ -v

# Extra verbose (more details)
uv run pytest tests/ -vv

# Maximum verbosity
uv run pytest tests/ -vvv

# Show print statements
uv run pytest tests/ -v -s

# Show local variables on failure
uv run pytest tests/ -v -l

# Short traceback format
uv run pytest tests/ -v --tb=short
```

### HTML Test Reports

First, add `pytest-html` to your dependencies using `uv`:

```bash
uv add --dev pytest-html
```

Then run:

```bash
# Generate HTML test report
uv run pytest tests/ -v --html=report.html --self-contained-html

# Open the report
# Linux/Mac: open report.html
# Or navigate to backend-core/report.html in your browser
```

### Coverage Reports

Install coverage tools using `uv`:

```bash
uv add --dev pytest-cov coverage
```

Run with coverage:

```bash
# Generate HTML coverage report
uv run pytest tests/ --cov=app --cov-report=html --cov-report=term

# Open the HTML report
# Navigate to backend-core/htmlcov/index.html in your browser
```

### Combined: Detailed Output + HTML + Coverage

```bash
uv run pytest tests/ \
  -vv \
  -s \
  -l \
  --tb=short \
  --html=test-report.html \
  --self-contained-html \
  --cov=app \
  --cov-report=html \
  --cov-report=term-missing \
  --durations=10
```

### Other Useful Options

```bash
# Stop on first failure
uv run pytest tests/ -v -x

# Run only tests matching a pattern
uv run pytest tests/ -k "test_pattern"

# Show test durations
uv run pytest tests/ -v --durations=10

# Run tests in parallel (requires pytest-xdist)
uv run pytest tests/ -n auto
```

## Test Structure

### Organization

- Tests are organized by module/service: `tests/services/[service]/test_*.py`
- Each test file follows the pattern: `test_<module_name>.py`
- Test classes group related test cases: `Test<FeatureName>`
- Test methods follow the pattern: `test_<feature_description>`

### Test Files

- Unit tests: Test individual functions and methods in isolation
- Integration tests: Test interactions between components
- Test fixtures: Shared test data and setup (defined in `conftest.py`)

## Test Configuration

### conftest.py

- Located at `tests/conftest.py`
- Loads environment variables from `secret/.env` (relative to project root)
- Mocks external services (e.g., GCP Secret Manager) to avoid authentication errors
- Sets up test environment before any imports
- Provides shared fixtures for all tests

### Environment Variables

Tests require environment variables to be configured. These are typically loaded from:

- `secret/.env` file (relative to project root)
- Environment variables set in the shell
- `conftest.py` configuration

Check `conftest.py` and `app/config/settings.py` for required environment variables.

## Writing New Tests

### Best Practices

1. **Follow existing patterns**: Use class-based tests with descriptive names
2. **Use descriptive names**: Test names should clearly describe what they validate
3. **Add docstrings**: Explain what each test validates
4. **Group related tests**: Use test classes to organize related test cases
5. **Use fixtures**: Share common setup code via pytest fixtures
6. **Keep tests isolated**: Each test should be independent and not rely on other tests
7. **Mock external dependencies**: Use mocks for external services, databases, etc.

### Test Structure Example

```python
import pytest
from unittest.mock import MagicMock, patch

class TestFeatureName:
    """Test suite for FeatureName functionality."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        return MagicMock()

    def test_feature_behavior(self, mock_db):
        """Test that feature behaves correctly."""
        # Arrange
        # Act
        # Assert
        pass
```

## Troubleshooting

### Tests Not Finding Modules

- Ensure you're running from the `backend-core` directory
- Check that `PYTHONPATH` includes the project root
- Verify dependencies are installed using `uv sync`

### Environment Variable Errors

- Ensure `secret/.env` exists and contains required variables
- Check `conftest.py` for environment variable loading logic
- Verify GCP Secret Manager mocking is working

### Import Errors

- Ensure all dependencies are installed
- Check that test files follow the correct naming convention (`test_*.py`)
- Verify `__init__.py` files exist in test directories

### Coverage Not Generating

- Ensure `pytest-cov` is installed using `uv add --dev pytest-cov coverage`
- Check that `--cov` flag specifies the correct module path
- Verify coverage report directory permissions

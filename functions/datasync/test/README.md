# Datasync Test Suite

Clean, organized test coverage for the datasync service.

## Test Structure

### Core Test Modules

- **`test_schemas.py`** - Pydantic model validation tests
  - `TestSurveyFeedColumns` - Survey feed column schema tests
  - `TestStoreSchemas` - Store and StoreCSVData schema tests  
  - `TestMemberFeedColumns` - Member feed column schema tests

- **`test_handlers.py`** - Data processing handler tests
  - `TestStoreHandler` - Store data processing tests
  - `TestMemberFeedHandler` - Member feed processing tests
  - `TestSurveyFeedHandler` - Survey feed processing tests

- **`test_utils.py`** - Utility function tests
  - `TestFileValidation` - File validation utility tests
  - `TestDataProcessing` - Data processing utility tests
  - `TestContextManagers` - Context manager utility tests
  - `TestCSVUtils` - CSV processing utility tests

### Test Runner

- **`run_all_tests.py`** - Main test runner that executes all test modules

## Running Tests

```bash
# Run all tests
python test/run_all_tests.py

# Run individual test modules
python test/test_schemas.py
python test/test_handlers.py  
python test/test_utils.py
```

## Test Design Principles

- **Clean Organization**: Tests grouped by functionality in classes
- **Proper Mocking**: Database and external dependencies mocked
- **Comprehensive Coverage**: Tests cover schemas, handlers, and utilities
- **Clear Assertions**: Each test validates specific behavior
- **Isolated Tests**: Tests don't depend on each other

## What We Test

### Schemas
- Pydantic v2 field validation
- Empty string to None conversion
- Datetime parsing and validation
- `populate_by_name` functionality

### Handlers  
- File validation logic
- Data cleaning and transformation
- Batch processing workflows
- Advisory lock usage
- Error handling

### Utilities
- File path validation
- Large dataset batching
- Safe database operations
- CSV streaming from GCS
- Context manager behavior

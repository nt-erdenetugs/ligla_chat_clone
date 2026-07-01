#!/usr/bin/env python3
"""Test runner for datasync tests."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from test_schemas import run_tests as run_schemas_tests
from test_handlers import run_tests as run_handlers_tests
from test_utils import run_tests as run_utils_tests


def main():
    """Run all tests."""
    print("🚀 Datasync Test Suite")
    print("=" * 50)

    all_passed = True

    # Run schema tests
    print()
    if not run_schemas_tests():
        all_passed = False

    # Run handler tests
    print()
    if not run_handlers_tests():
        all_passed = False

    # Run utility tests
    print()
    if not run_utils_tests():
        all_passed = False

    # Final result
    print("\n" + "=" * 50)
    if all_passed:
        print("ALL TESTS PASSED - Ready!")
    else:
        print("❌ SOME TESTS FAILED - Review Issues Above")

    return all_passed


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

import re

from logger.logger import FileValidationError


def validate_file(file_name: str, directory_name: str, filename_pattern: str) -> str:
    if not file_name.endswith(".csv"):
        raise FileValidationError("Filename must end with '.csv'")

    file_name = file_name.strip("/")
    parts = file_name.split("/")

    if len(parts) == 3:
        org_name, dir_name, filename = parts
        if dir_name != directory_name:
            raise FileValidationError(
                f"Expected directory '{directory_name}', got '{dir_name}'"
            )
        if filename_pattern not in filename:
            raise FileValidationError(f"Filename must contain '{filename_pattern}'")
        if org_name != filename.split("-")[0]:
            raise FileValidationError(f"Organization name don't match '{org_name}' in {filename}")
    elif len(parts) == 1:
        filename = parts[0]
        if filename_pattern not in filename:
            raise FileValidationError(f"Filename must contain '{filename_pattern}'")
        org_name = filename.split(filename_pattern)[0]
    else:
        raise FileValidationError(f"Unsupported path format for {directory_name} files")

    filename_no_ext = filename[:-4]
    required_start = f"{org_name}{filename_pattern}"
    if not filename_no_ext.startswith(required_start):
        raise FileValidationError(f"Filename must start with '{required_start}'")

    date_time_part = filename_no_ext[len(required_start) :]
    if not re.match(r"^\d{8}_\d{6}(\d{3})?$", date_time_part):
        raise FileValidationError(
            "Filename must end with date/time in format: YYYYMMDD_HHMMSS or "
            "YYYYMMDD_HHMMSSXXX"
        )

    return org_name

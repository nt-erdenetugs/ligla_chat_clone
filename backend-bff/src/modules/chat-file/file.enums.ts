// File type mappings for validation
export const ALLOWED_FILE_EXTENSIONS: Record<string, string[]> = {
  DOCUMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  VIDEO: ['mp4', 'mov', 'avi', 'webm'],
  AUDIO: ['mp3', 'wav', 'ogg', 'm4a'],
  ARCHIVE: ['zip'],
};

// Maximum file size: 200MB
export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

// GCS folder paths
export const FILE_STORAGE_PATHS = {
  PENDING: 'files/pending',
  PROCESSED: 'files/processed',
  FAILED: 'files/failed',
} as const;

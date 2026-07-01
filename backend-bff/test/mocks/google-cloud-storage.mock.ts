type MockFileConfig = {
  size?: number;
  content?: Buffer | string;
};

type MockStorageCall = {
  bucketName: string;
  filePath: string;
};

const files = new Map<string, MockFileConfig>();
const calls = {
  getMetadata: [] as MockStorageCall[],
  download: [] as MockStorageCall[],
};

function buildKey(bucketName: string, filePath: string): string {
  return `${bucketName}/${filePath}`;
}

export function resetMockStorage(): void {
  files.clear();
  calls.getMetadata = [];
  calls.download = [];
}

export function setMockStorageFile(
  bucketName: string,
  filePath: string,
  config: MockFileConfig = {},
): void {
  files.set(buildKey(bucketName, filePath), config);
}

export function getMockStorageCalls() {
  return {
    getMetadata: [...calls.getMetadata],
    download: [...calls.download],
  };
}

class MockFile {
  constructor(
    private readonly bucketName: string,
    private readonly filePath: string,
  ) {}

  async getMetadata(): Promise<Array<{ size: string }>> {
    calls.getMetadata.push({ bucketName: this.bucketName, filePath: this.filePath });

    const config = files.get(buildKey(this.bucketName, this.filePath));
    if (!config) {
      throw new Error(`Mock GCS file not found: ${this.bucketName}/${this.filePath}`);
    }

    const size =
      config.size ??
      (typeof config.content === 'string'
        ? Buffer.byteLength(config.content)
        : (config.content?.length ?? 0));

    return [{ size: String(size) }];
  }

  async download(): Promise<[Buffer]> {
    calls.download.push({ bucketName: this.bucketName, filePath: this.filePath });

    const config = files.get(buildKey(this.bucketName, this.filePath));
    if (!config) {
      throw new Error(`Mock GCS file not found: ${this.bucketName}/${this.filePath}`);
    }

    const buffer = Buffer.isBuffer(config.content)
      ? config.content
      : Buffer.from(config.content ?? 'mock-gcs-content');

    return [buffer];
  }
}

class MockBucket {
  constructor(private readonly bucketName: string) {}

  file(filePath: string): MockFile {
    return new MockFile(this.bucketName, filePath);
  }
}

export class Storage {
  bucket(bucketName: string): MockBucket {
    return new MockBucket(bucketName);
  }
}

import { customType } from 'drizzle-orm/pg-core';

export const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array | string }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    if (Buffer.isBuffer(value)) {
      return value;
    }

    if (value instanceof Uint8Array) {
      return Buffer.from(value);
    }

    if (typeof value === 'string') {
      if (value.startsWith('\\x')) {
        return Buffer.from(value.slice(2), 'hex');
      }
      return Buffer.from(value, 'utf-8');
    }

    throw new Error(`Unexpected bytea driver value type: ${typeof value}`);
  },
});

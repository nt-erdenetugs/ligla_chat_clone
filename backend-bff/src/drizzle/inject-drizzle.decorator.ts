import { Inject } from '@nestjs/common';
import { DRIZZLE_DB } from './drizzle.provider';

export const InjectDrizzle = () => Inject(DRIZZLE_DB);

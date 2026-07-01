import { Module } from '@nestjs/common';

import { LiglaService } from './ligla.service';

const isDevelopmentOrTest =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

@Module({
  providers: [
    ...(isDevelopmentOrTest
      ? [
          {
            provide: LiglaService,
            useFactory: async () => {
              const { MockLiglaService } = await import('../../../test/mocks/ligla.service.mock');
              return new MockLiglaService();
            },
          },
        ]
      : [LiglaService]),
  ],
  exports: [LiglaService],
})
export class LiglaModule {}

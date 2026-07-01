import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { WinstonModule } from 'nest-winston';
import { I18nMiddleware, I18nValidationPipe } from 'nestjs-i18n';

import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/Interceptor/logging.interceptor';
import { CloudLogging } from './common/lib/CloudLogging';

declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({ instance: CloudLogging }),
  });
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const port = process.env.BFF_PORT ?? process.env.PORT ?? 3000;

  app.enableCors({
    origin: corsOrigin?.split(',') ?? [],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        return new BadRequestException(
          validationErrors.map((error) => ({
            field: error.property,
            error: error.constraints
              ? Object.values(error.constraints).join(', ')
              : 'Internal Server Error',
          })),
        );
      },
    }),
    // TODO: Implement validation to DTOs [phase 2][task 92946379]
    new I18nValidationPipe(),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.use(I18nMiddleware);
  await app.listen(port);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();

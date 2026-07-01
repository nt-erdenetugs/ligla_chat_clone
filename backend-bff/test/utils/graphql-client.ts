import { INestApplication } from '@nestjs/common';

import request from 'supertest';

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: {
      code: string;
      status: number;
    };
  }>;
}

export class GraphQLClient {
  constructor(private app: INestApplication) {}

  async query<T = any>(
    query: string,
    variables?: Record<string, any>,
    authToken?: string,
  ): Promise<GraphQLResponse<T>> {
    const req = request(this.app.getHttpServer())
      .post('/api')
      .send({ query, variables })
      .set('Accept-Language', 'en');

    if (authToken) {
      req.set('Authorization', `Bearer ${authToken}`);
    }

    const response = await req;
    return response.body;
  }

  async mutate<T = any>(
    mutation: string,
    variables?: Record<string, any>,
    authToken?: string,
  ): Promise<GraphQLResponse<T>> {
    return this.query<T>(mutation, variables, authToken);
  }

  // Helper for operations that should succeed
  async queryExpectSuccess<T = any>(
    query: string,
    variables?: Record<string, any>,
    authToken?: string,
  ): Promise<T> {
    const response = await this.query<T>(query, variables, authToken);
    if (response.errors?.length) {
      console.error('Unexpected GraphQL errors:', JSON.stringify(response.errors, null, 2));
    }
    expect(response.errors).toBeUndefined();
    expect(response.data).toBeDefined();
    return response.data!;
  }

  // Helper for operations that should fail
  async queryExpectError(
    query: string,
    expectedErrorMessage?: string,
    variables?: Record<string, any>,
    authToken?: string,
  ): Promise<GraphQLResponse> {
    const response = await this.query(query, variables, authToken);
    expect(response.errors).toBeDefined();
    expect(response.errors!.length).toBeGreaterThan(0);

    if (expectedErrorMessage) {
      const hasExpectedError = response.errors!.some((error) =>
        error.message.includes(expectedErrorMessage),
      );
      if (!hasExpectedError) {
        console.error('Expected error message:', expectedErrorMessage);
        console.error('Actual errors:', JSON.stringify(response.errors, null, 2));
      }
      expect(hasExpectedError).toBe(true);
    }

    return response;
  }
}

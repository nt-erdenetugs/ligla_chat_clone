import { JwtService } from '@nestjs/jwt';

import { Pool } from 'pg';

export class AuthHelper {
  private jwtService: JwtService;
  private pool: Pool;

  constructor() {
    this.jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'test_jwt_secret_key_for_e2e_testing_only',
    });
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  // Generate JWT token for a user
  generateToken(userId: string, isHypervisor: boolean = false): string {
    return this.jwtService.sign({ userId, isHypervisor });
  }

  // Create tokens for test users by role
  async getAdminToken(organizationName: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT u.id
       FROM "user" u
       JOIN "auth" a ON u.id = a.id
       WHERE u."organizationName" = $1
         AND u."roleType" = 'ADMIN'::"roletype"
         AND a.status = 'ACTIVE'::"userstatus"
       LIMIT 1`,
      [organizationName],
    );
    const admin = result.rows.length > 0 ? result.rows[0] : null;
    if (!admin) throw new Error(`Admin user not found for org: ${organizationName}`);
    return this.generateToken(admin.id);
  }

  async getManagerToken(organizationName: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT u.id
       FROM "user" u
       JOIN "auth" a ON u.id = a.id
       WHERE u."organizationName" = $1
         AND u."roleType" = 'MANAGER'::"roletype"
         AND a.status = 'ACTIVE'::"userstatus"
       LIMIT 1`,
      [organizationName],
    );
    const manager = result.rows.length > 0 ? result.rows[0] : null;
    if (!manager) throw new Error(`Manager user not found for org: ${organizationName}`);
    return this.generateToken(manager.id);
  }

  async getOperatorToken(organizationName: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT u.id
       FROM "user" u
       JOIN "auth" a ON u.id = a.id
       WHERE u."organizationName" = $1
         AND u."roleType" = 'OPERATOR'::"roletype"
         AND a.status = 'ACTIVE'::"userstatus"
       LIMIT 1`,
      [organizationName],
    );
    const operator = result.rows.length > 0 ? result.rows[0] : null;
    if (!operator) throw new Error(`Operator user not found for org: ${organizationName}`);
    return this.generateToken(operator.id);
  }

  async getHypervisorToken(): Promise<string> {
    const result = await this.pool.query<{ id: string }>(`SELECT id FROM "hypervisorUser" LIMIT 1`);
    const hypervisor = result.rows.length > 0 ? result.rows[0] : null;
    if (!hypervisor) throw new Error('Hypervisor user not found');
    return this.generateToken(hypervisor.id, true);
  }

  async getToken(email: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM "auth" WHERE email = $1 LIMIT 1`,
      [email],
    );
    const user = result.rows.length > 0 ? result.rows[0] : null;
    if (!user) throw new Error(`User not found with email: ${email}`);
    return this.generateToken(user.id);
  }

  async cleanup() {
    await this.pool.end();
  }
}

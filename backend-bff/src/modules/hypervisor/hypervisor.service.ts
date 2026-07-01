import { Injectable, NotFoundException } from '@nestjs/common';

import { eq } from 'drizzle-orm';

import { DrizzleDB, InjectDrizzle } from '@/drizzle';
import { User } from '@/modules/user/entities/user.entity';
import { SystemUserType } from '@/modules/user/enums';
import * as shared from '@@/drizzle/public/schema';

@Injectable()
export class HypervisorService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async findOne(id: string): Promise<User> {
    const hypervisor = await this.db
      .select()
      .from(shared.hypervisorUser)
      .where(eq(shared.hypervisorUser.id, id))
      .then((rows) => rows[0] || null);

    return this.aggregateHypervisor(hypervisor);
  }

  private aggregateHypervisor(hypervisor: typeof shared.hypervisorUser.$inferSelect | null): User {
    if (!hypervisor) {
      throw new NotFoundException(`Hypervisor user not found`);
    }

    return {
      displayName: '',
      pictureUrl: null,
      roleType: '',
      status: '',
      systemUserType: SystemUserType.HYPERVISOR,
      id: hypervisor.id,
      email: hypervisor.email,
      createdAt: hypervisor.createdAt,
      teams: [],
    };
  }
}

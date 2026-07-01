# GitHub Copilot Instructions for Ligla Chat

## Project Context

This is a multi-tenant chat management system with a three-tier architecture:

- **backend-core**: FastAPI service (Python) for message processing and external integrations
- **backend-bff**: NestJS service (TypeScript) providing GraphQL API as backend-for-frontend
- **frontend**: React SPA (TypeScript) with Material-UI for operator interface
- **functions**: Google Cloud Functions for data synchronization

## Code Style and Conventions

### TypeScript/JavaScript (backend-bff, frontend)

- Use TypeScript strict mode with explicit types
- Prefer interfaces over type aliases for object shapes
- Use enum values from generated GraphQL types
- Follow existing ESLint configuration
- Use camelCase for variables and functions, PascalCase for components and classes

### Python (backend-core)

- Follow PEP 8 with line length of 120 characters
- Use Black formatter settings
- Prefer type hints for all function parameters and return values
- Use snake_case for variables and functions
- Use descriptive variable names reflecting business domain

### Database and ORM Patterns

- **backend-bff**: Use Prisma ORM with existing schema patterns
- **backend-core**: Use SQLAlchemy ORM with existing model patterns
- Always include `organizationName` for multi-tenant isolation
- Use soft deletion with `isActive` boolean fields
- Include audit fields: `createdAt`, `updatedAt`, `archivedBy`, `archivedAt`

## Architecture Patterns

### Backend-BFF (NestJS/GraphQL)

- Follow domain-driven module structure: `[domain].module.ts`, `[domain].resolver.ts`, `[domain].service.ts`
- Place DTOs in `dto/` folder, entities in `entities/` folder
- Use NestJS decorators: `@Resolver()`, `@Query()`, `@Mutation()`, `@Args()`
- Implement cursor-based pagination for list queries
- Use role-based guards: `@UseGuards(RoleGuard)`, `@Roles(Role.ADMIN)`
- Handle errors with i18n: `throw new GraphQLError(this.i18n.t('errors.not_found'))`

### Frontend (React)

- Use functional components with hooks
- Organize by feature modules under `src/modules/[Domain]/`
- Place GraphQL queries in `graphql/` folder within each module
- Use Apollo Client hooks: `useQuery`, `useMutation`, `useLazyQuery`
  - Never use onError, onCompleted callbacks in `useQuery`, `useInfiniteQuery`, `useLazyQuery` hooks
- Implement error boundaries and loading states
- Use Material-UI components with consistent theming
- Follow existing form patterns with react-hook-form and Zod validation

### Backend-Core (FastAPI)

- Use dependency injection pattern with `Depends()`
- Organize endpoints by domain in `services/` folder
- Use Pydantic models for request/response validation
- Implement proper error handling with HTTP status codes
- Use repository pattern for database operations

## Common Patterns and Examples

### GraphQL Resolver Pattern (backend-bff)

```typescript
@Resolver(() => Chat)
export class ChatResolver {
  @Query(() => ChatPaginatedResponse)
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.OPERATOR, Role.MANAGER, Role.ADMIN)
  async chats(@Args() args: ChatFilterInput, @CurrentUser() user: User): Promise<ChatPaginatedResponse> {
    return this.chatService.findChats(args, user);
  }
}
```

### React Component Pattern (frontend)

```typescript
export const ChatList: React.FC = () => {
  const { data, loading, error } = useQuery(GET_CHATS);
  const { t } = useTranslation();

  if (loading) return <Loading />;
  if (error) return <ErrorFallback error={error} />;

  return (
    <DataTable
      data={data?.chats?.nodes || []}
      columns={chatColumns}
    />
  );
};
```

### Database Model Pattern (backend-core)

```python
class Chat(BaseModel):
    __tablename__ = "chats"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_name = Column(String, ForeignKey("organizations.name"), nullable=False)
    status = Column(Enum(ChatStatus), nullable=False, default=ChatStatus.NEW)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

## Business Domain Context

### Key Entities

- **Organization**: Multi-tenant organization with LIFF integration
- **User**: Role-based users (ADMIN, MANAGER, OPERATOR) with team assignments
- **Team**: Organizational units with store assignments and chat settings
- **Store**: Physical/logical store entities integrated with Ligla platform
- **Chat**: Central chat entity with status tracking and assignments
- **EndUser**: External chat participants (typically LINE users)

### Chat Status Flow

- NEW → ASSIGNED → IN_PROGRESS → RESOLVED/CLOSED
- Support for team assignments and operator assignments
- Activity tracking for all status changes

### Role-Based Access Control

- **ADMIN**: Full system access, organization management
- **MANAGER**: Team and user management, chat supervision
- **OPERATOR**: Chat handling and customer interactions

## Integration Patterns

### Real-time Updates

- Use Server-Sent Events (SSE) for real-time chat updates in frontend
- Implement Pub/Sub pattern for message processing in backend-core
- Handle reconnection and error states gracefully

### File Uploads

- Support multiple file types: images, videos, audio, documents
- Use Google Cloud Storage for file persistence
- Implement proper file validation and security checks

### Internationalization

- Support Japanese and English languages
- Use translation keys: `t('common.save')`, `t('errors.validation.required')`
- Place translation files in appropriate locale folders

## Testing Patterns

### Backend-BFF Testing

```typescript
describe('ChatResolver', () => {
  it('should return paginated chats', async () => {
    const result = await resolver.chats(mockArgs, mockUser);
    expect(result.nodes).toBeDefined();
    expect(result.pageInfo).toBeDefined();
  });
});
```

### Frontend Testing

```typescript
describe('ChatList', () => {
  it('renders chat list correctly', () => {
    render(<ChatList />, { wrapper: TestProviders });
    expect(screen.getByText('Chat List')).toBeInTheDocument();
  });
});
```

## Development Commands

- `make install` - Setup and start all services
- `make generate` - Generate Prisma client after schema changes
- `make generate-types` - Generate GraphQL types for frontend
- `make db-reset` - Reset database with fresh migrations and seed data
- `make lint` - Run linting across all services

## Security Considerations

- Always validate user permissions before data access
- Use parameterized queries to prevent SQL injection
- Implement proper CORS configuration
- Never log sensitive information (passwords, tokens)
- Use environment variables for all configuration values
- Implement rate limiting for API endpoints

## Performance Guidelines

- Use cursor-based pagination for large datasets
- Implement proper database indexing
- Use lazy loading for GraphQL resolvers
- Optimize database queries with appropriate joins
- Implement proper caching strategies for frequently accessed data

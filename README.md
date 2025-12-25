# Agent Orchestrator

A multi-agent orchestration platform for managing AI-powered coding agents. This dashboard provides real-time monitoring, task management, and exception handling for autonomous agent workflows.

## Features

- **Agent Management**: Monitor and control multiple AI agents working on coding tasks
- **Task Queue**: Create, prioritize, and track tasks through their lifecycle
- **Exception Handling**: Review and resolve issues that require human intervention
- **Verification Pipeline**: Automated code verification with syntax, type, lint, and test checks
- **File Locking**: Coordinated file access to prevent conflicts between agents
- **Real-time Dashboard**: Monitor system health, agent status, and task progress

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended for serverless)
- npm or yarn

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/agent-orchestrator.git
   cd agent-orchestrator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your database connection:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
   ```

4. **Set up the database**
   ```bash
   npm run db:migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open the dashboard**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel

2. **Configure environment variables** in Vercel dashboard:
   - `DATABASE_URL` - Your Neon PostgreSQL connection string
   - `CRON_SECRET` - Secret for authenticating cron jobs (generate a random string)

3. **Deploy**

   Vercel will automatically build and deploy on push to main.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CRON_SECRET` | Production | Secret for cron job authentication |
| `RATE_LIMIT_ENABLED` | No | Set to "false" to disable rate limiting |
| `NODE_ENV` | No | "development" or "production" |

## API Documentation

### Health Check

```
GET /api/health
```

Returns system health status including database connectivity.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": { "status": "ok", "latencyMs": 5 }
  }
}
```

### Tasks

```
GET    /api/tasks          # List tasks with pagination
POST   /api/tasks          # Create a new task
GET    /api/tasks/:id      # Get task details
PATCH  /api/tasks/:id      # Update task status
DELETE /api/tasks/:id      # Delete a task
```

**Create Task:**
```json
{
  "title": "Implement user authentication",
  "description": "Add login/logout functionality with JWT tokens",
  "priority": 1,
  "riskLevel": "LOW",
  "filesHint": ["src/auth/", "src/middleware/"]
}
```

### Agents

```
GET    /api/agents         # List all agents
GET    /api/agents/:id     # Get agent details
GET    /api/agents/:id/logs # Get agent activity logs
```

### Exceptions

```
GET    /api/exceptions     # List exceptions
GET    /api/exceptions/:id # Get exception details
PATCH  /api/exceptions/:id # Resolve an exception
```

### File Locks

```
GET    /api/locks          # List active file locks
POST   /api/locks/check    # Check if files can be locked
```

### Dashboard Stats

```
GET    /api/dashboard/stats # Get aggregated statistics
```

## Architecture

```
agent-orchestrator/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   └── (pages)/      # UI pages
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Shared utilities
│   │   ├── db.ts         # Database client
│   │   ├── errors.ts     # Error handling
│   │   └── logger.ts     # Structured logging
│   ├── services/         # Business logic
│   │   ├── agent-runner.ts
│   │   ├── coordinator-service.ts
│   │   ├── supervisor-service.ts
│   │   └── verification-service.ts
│   └── types/            # TypeScript types
├── prisma/
│   └── schema.prisma     # Database schema
├── cli/                  # CLI tool (swarm)
└── public/               # Static assets
```

### Core Services

- **AgentRunner**: Executes tasks using AI agents with tool access
- **CoordinatorService**: Manages file locks and agent coordination
- **SupervisorService**: Monitors agents and handles automatic recovery
- **VerificationService**: Runs code verification checks

### Database Schema

- **Agent**: Represents an AI agent instance
- **Task**: Work items to be completed by agents
- **Exception**: Issues requiring human review
- **FileLock**: Active file locks for coordination
- **VerificationResult**: Results from code verification
- **AgentLog**: Activity logs from agent execution

## CLI Tool

The `swarm` CLI provides command-line management:

```bash
# List agents
npx ts-node cli/index.ts agent list

# Create a task
npx ts-node cli/index.ts task create "Fix bug in login" --priority 0

# View exceptions
npx ts-node cli/index.ts exception list --status OPEN
```

## Development

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

## Error Handling

All API responses follow a consistent format:

**Success:**
```json
{
  "data": { ... }
}
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": { ... },
    "requestId": "req_abc123"
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `BAD_REQUEST` | 400 | Invalid request format |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

API routes are rate limited to 100 requests per minute per IP. Rate limit headers are included in responses:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Security

- All API routes include security headers
- CORS is configured for same-origin requests
- Rate limiting prevents abuse
- Request IDs enable tracing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Keep commits focused and descriptive

## License

MIT License - see [LICENSE](LICENSE) for details.

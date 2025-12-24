# Agent Orchestrator

A platform for orchestrating AI agents that work on software development tasks.

## Features

- **Agent Management**: Spawn, monitor, and control AI agents
- **Task Queue**: Priority-based task queue with automatic retry
- **Verification**: Automated verification of agent work (lint, types, tests)
- **Exception Handling**: Track and resolve issues requiring human review
- **CLI Tool**: Command-line interface for managing agents and tasks

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Neon (serverless)
- **ORM**: Prisma
- **AI**: Anthropic Claude API
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Neon database account (or local PostgreSQL)
- Anthropic API key

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd agent-orchestrator
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.production.example .env.local
   # Edit .env.local with your values
   ```

4. **Set up the database**:
   ```bash
   npm run db:push
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Open the dashboard**:
   Visit [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

### 1. Set Up Neon Database

1. Create a Neon account at [neon.tech](https://neon.tech)
2. Create a new project and database
3. Copy the connection string from the dashboard

### 2. Configure Vercel

1. **Import the project**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your repository

2. **Add environment variables**:
   In the Vercel dashboard, add these environment variables:

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | Neon PostgreSQL connection string |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key |
   | `CRON_SECRET` | Random secret for cron authentication |
   | `NEXT_PUBLIC_APP_URL` | Your deployed app URL |

   You can generate a secure `CRON_SECRET` with:
   ```bash
   openssl rand -base64 32
   ```

3. **Deploy**:
   Click "Deploy" and Vercel will:
   - Install dependencies
   - Generate Prisma client
   - Build the Next.js application

### 3. Run Database Migrations

After the first deployment, run migrations:

```bash
# Using Vercel CLI
vercel env pull .env.local
npm run db:migrate
```

Or use the Neon SQL Editor to run migration SQL directly.

### 4. Verify Deployment

1. Visit your deployed URL
2. Check the health endpoint: `https://your-app.vercel.app/api/health`
3. Verify the cron job is running in Vercel Functions logs

## CLI Tool

The project includes a CLI tool for managing agents and tasks.

### Installation

```bash
cd cli
npm install
npm run build
npm link
```

### Commands

```bash
swarm init                    # Initialize configuration
swarm status                  # Show system status
swarm spawn [taskId]          # Spawn agent(s)
swarm stop [agentId]          # Stop agent(s)
swarm logs [agentId]          # View agent logs
swarm task add [title]        # Create a task
swarm task list               # List tasks
swarm task view <id>          # View task details
swarm task run <id>           # Run a queued task
swarm queue                   # Show task queue
swarm agents                  # List all agents
```

## Project Structure

```
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/              # API routes
│   │   │   ├── agents/       # Agent endpoints
│   │   │   ├── tasks/        # Task endpoints
│   │   │   ├── cron/         # Cron job endpoints
│   │   │   └── ...
│   │   ├── agents/           # Agent dashboard pages
│   │   ├── tasks/            # Task management pages
│   │   └── exceptions/       # Exception review pages
│   ├── components/           # React components
│   ├── hooks/                # React hooks
│   ├── lib/                  # Utilities
│   │   ├── db.ts             # Database client
│   │   └── env.ts            # Environment validation
│   └── services/             # Business logic
│       ├── agent-runner.ts   # Agent execution
│       ├── supervisor-service.ts  # Monitoring
│       └── verification-service.ts
├── cli/                      # CLI tool
├── prisma/                   # Database schema
└── vercel.json               # Vercel configuration
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `CRON_SECRET` | Production | Secret for cron job authentication |
| `NEXT_PUBLIC_APP_URL` | No | Public URL of the application |

## API Endpoints

### Agents
- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Get agent details
- `POST /api/agents/spawn` - Spawn new agent
- `PATCH /api/agents/:id` - Update agent (stop/pause/resume)
- `GET /api/agents/:id/logs` - Get agent logs

### Tasks
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get task details
- `PATCH /api/tasks/:id` - Update task
- `POST /api/tasks/:id/run` - Start task execution
- `POST /api/tasks/:id/retry` - Retry failed task

### Health
- `GET /api/health` - Health check endpoint
- `GET /api/cron/cleanup` - Cron cleanup job (Vercel Cron)

## License

MIT

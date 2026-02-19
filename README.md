# Distributed Task Scheduler

A distributed task scheduling system built with Node.js that enables scheduling, picking, and executing jobs asynchronously using PostgreSQL for persistence and BullMQ (Redis) for queue management.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Express API   │────▶│   PostgreSQL    │◀────│     Picker      │
│   (Port 3000)   │     │   (Jobs Table)  │     │    (Worker)     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │   Redis Queue   │
                                                │    (BullMQ)     │
                                                └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │    Executor     │
                                                │    (Worker)     │
                                                └─────────────────┘
```

## Components

### 1. Express Server (`src/index.js`)

- Main API server running on port 3000
- Handles job creation and management via REST endpoints
- Integrates Bull Board for queue monitoring at `/admin/queues`

### 2. Picker Worker (`src/workers/picker.js`)

- Polls PostgreSQL every 2 seconds for jobs due for execution
- Uses `FOR UPDATE SKIP LOCKED` for distributed locking (prevents duplicate processing)
- Picks up to 10 jobs per cycle
- Pushes picked jobs to Redis queue (BullMQ)

### 3. Executor Worker (`src/workers/executor.js`)

- Consumes jobs from the Redis queue
- Executes different task types:
  - `create_folder` - Creates a directory at specified path
  - `write_file` - Writes content to a file
  - `send_email` - Sends emails via nodemailer
- Updates job status in PostgreSQL (running → completed/failed)
- Supports automatic retries (3 attempts with exponential backoff)

### 4. Bull Board (`src/bullBoard.js`)

- Web-based dashboard for monitoring queue status
- Accessible at `/admin/queues`

## Job Lifecycle

```
pending → picked → running → completed
                         ↘ failed
                         ↘ cancelled
```

| Status      | Description                            |
| ----------- | -------------------------------------- |
| `pending`   | Job created, waiting to be picked      |
| `picked`    | Job selected by picker, added to queue |
| `running`   | Job currently being executed           |
| `completed` | Job finished successfully              |
| `failed`    | Job execution failed                   |
| `cancelled` | Job cancelled by user                  |

## Database Schema

### Jobs Table

```sql
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    task JSONB NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    picked_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Job Templates Table

```sql
CREATE TABLE job_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    task JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Create Job

```http
POST /api/job
Content-Type: application/json

{
  "task": {
    "type": "send_email",
    "data": {
      "to": "user@example.com",
      "subject": "Hello",
      "message": "This is a test email"
    }
  },
  "scheduled_at": "2026-02-19T10:00:00Z"
}
```

### List Jobs (with Search, Filter & Pagination)

```http
GET /api/jobs?page=1&limit=20&status=pending&taskType=send_email&search=user&startDate=2026-02-01&endDate=2026-02-28
```

Returns paginated jobs with filters.

### Get Statistics

```http
GET /api/stats
```

Returns job statistics including status counts, task type distribution, and performance metrics.

### Export Jobs to CSV

```http
GET /api/jobs/export?status=completed&taskType=send_email
```

Downloads a CSV file of jobs matching the filters.

### Duplicate Job

```http
POST /api/duplicate/:id
Content-Type: application/json

{
  "scheduled_at": "2026-02-20T10:00:00Z"
}
```

### Bulk Cancel

```http
POST /api/bulk/cancel
Content-Type: application/json

{
  "ids": [1, 2, 3, 4, 5]
}
```

### Bulk Retry

```http
POST /api/bulk/retry
Content-Type: application/json

{
  "ids": [6, 7, 8]
}
```

### Job Templates

```http
GET /api/templates          # List all templates
POST /api/templates         # Create template { name, task }
DELETE /api/templates/:id   # Delete template
POST /api/templates/:id/use # Create job from template { scheduled_at }
```

### Retry Job

```http
POST /api/retry/:id
```

Resets a failed job to pending status for re-execution.

### Cancel Job

```http
POST /api/cancel/:id
```

Marks a job as cancelled.

## Task Types

### 1. Create Folder

```json
{
  "type": "create_folder",
  "data": {
    "path": "/path/to/folder"
  }
}
```

### 2. Write File

```json
{
  "type": "write_file",
  "data": {
    "path": "/path/to/file.txt",
    "content": "File content here"
  }
}
```

### 3. Send Email

```json
{
  "type": "send_email",
  "data": {
    "to": "recipient@example.com",
    "subject": "Email Subject",
    "message": "Email body content"
  }
}
```

## Prerequisites

- Node.js (v16+)
- PostgreSQL
- Redis

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure PostgreSQL

Update `src/config/db.js` with your PostgreSQL credentials:

```javascript
const pool = new Pool({
  user: "your_user",
  host: "localhost",
  database: "scheduler",
  password: "your_password",
  port: 5432,
});
```

### 3. Configure Redis

Update `src/config/queue.js` if Redis is not running on default port:

```javascript
const queue = new Queue("jobs", {
  connection: {
    host: "127.0.0.1",
    port: 6379,
  },
});
```

### 4. Create Database Tables

```sql
CREATE DATABASE scheduler;

CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    task JSONB NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    picked_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Running the Application

Start each component in a separate terminal:

### Terminal 1: API Server

```bash
npm start
```

### Terminal 2: Picker Worker

```bash
npm run picker
```

### Terminal 3: Executor Worker

```bash
npm run executor
```

## Monitoring

Access Bull Board dashboard at: `http://localhost:3000/admin/queues`

## Dependencies

| Package             | Purpose                       |
| ------------------- | ----------------------------- |
| express             | Web server framework          |
| bullmq              | Redis-based queue system      |
| ioredis             | Redis client                  |
| pg                  | PostgreSQL client             |
| nodemailer          | Email sending                 |
| @bull-board/api     | Queue monitoring dashboard    |
| @bull-board/express | Bull Board Express adapter    |
| cors                | Cross-origin resource sharing |

## Distributed Features

- **Horizontal Scaling**: Run multiple picker and executor instances
- **Lock-Free Picking**: Uses `FOR UPDATE SKIP LOCKED` to prevent duplicate job processing
- **Fault Tolerance**: BullMQ provides automatic retry with exponential backoff
- **Persistence**: Jobs stored in PostgreSQL, queue backed by Redis

## License

MIT

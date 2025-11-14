# Lead Ingestion CRM Backend

Rock-solid, fault-tolerant lead ingestion system with **zero data loss guarantee**.

## Key Features

- **Zero Data Loss**: Every request is stored in raw format before processing
- **Idempotency Support**: Duplicate prevention via `Idempotency-Key` header
- **No Validation**: Accept and store all incoming data as-is
- **Full Observability**: Structured logging with complete error visibility
- **Type-Safe**: Modern TypeScript with strict typing
- **Production-Ready**: Graceful shutdown, error handling, health checks

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict mode)
- **HTTP Server**: Fastify
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Logging**: Pino (structured JSON logs)

## Architecture

### Zero Data Loss Strategy

1. **Raw Storage First**: Every incoming request is immediately stored in `leads_raw` table
2. **Normalized Storage**: Data is then parsed and stored in structured `leads` table
3. **Idempotency Handling**: Duplicate detection via unique constraint on `idempotencyKey`

Even if normalized storage fails, the raw data is preserved for manual recovery.

### Database Schema

#### `leads_raw` Table
- Stores complete JSON payload exactly as received
- Audit trail and disaster recovery
- Unique constraint on `idempotency_key`

#### `leads` Table
- Normalized, structured data for CRM operations
- All fields nullable (no validation)
- Ready for CRM UI integration
- Includes operational fields: `status`, `assignedTo`

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database

### Installation

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your database connection:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/leadcrm?schema=public"
   PORT=3000
   NODE_ENV=development
   LOG_LEVEL=info
   ```

3. **Run database migrations**:
   ```bash
   npx prisma migrate dev --name init
   ```

   This creates the `leads_raw` and `leads` tables.

4. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

5. **Start the server**:

   Development mode (with auto-reload):
   ```bash
   npm run dev
   ```

   Production mode:
   ```bash
   npm run build
   npm start
   ```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## API Endpoints

### Health Check

```http
GET /health
```

**Response**:
```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Lead Ingestion

```http
POST /api/lead
Content-Type: application/json
Idempotency-Key: <sha256-hash>
X-Request-Id: <unique-request-id>

{
  "click_id": "12345",
  "country": "LV",
  "creo": "banner-1",
  "description": "Interested in trading",
  "domain": "example.com",
  "email": "user@example.com",
  "firstName": "John",
  "ip": "192.168.1.1",
  "lang": "lv",
  "lastName": "Doe",
  "marker": "Pureshka",
  "offer": "Baltic Capital Native",
  "phone": "+371123456789",
  "sourcetype": "web"
}
```

**Headers**:
- `Idempotency-Key` (optional): Unique key for deduplication (e.g., SHA256 of email|phone|date)
- `X-Request-Id` (optional): Request tracking ID

**Responses**:

**Success - New Lead** (201 Created):
```json
{
  "ok": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "deduplicated": false
}
```

**Success - Duplicate** (409 Conflict):
```json
{
  "ok": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "deduplicated": true
}
```

Note: 409 is treated as success by the PHP sender - the lead already exists.

**Error - Invalid Payload** (400 Bad Request):
```json
{
  "ok": false,
  "error": "invalid_payload"
}
```

**Error - Internal Server Error** (500):
```json
{
  "ok": false,
  "error": "internal_error"
}
```

## Project Structure

```
leadCRM/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── db/
│   │   └── prisma.ts          # Prisma client singleton
│   ├── routes/
│   │   └── lead.ts            # Lead ingestion route
│   ├── services/
│   │   └── leadService.ts     # Business logic
│   ├── types/
│   │   └── lead.ts            # TypeScript types
│   ├── utils/
│   │   └── errors.ts          # Error handling utilities
│   ├── config.ts              # Environment configuration
│   ├── logger.ts              # Structured logging
│   └── server.ts              # Fastify server bootstrap
├── .env.example               # Environment template
├── .eslintrc.json             # ESLint config
├── .prettierrc                # Prettier config
├── package.json
├── tsconfig.json              # TypeScript config
└── README.md
```

## Development

### Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npx prisma studio` - Open Prisma Studio (database GUI)
- `npx prisma migrate dev` - Create and apply migrations

### Database Management

**Create a new migration**:
```bash
npx prisma migrate dev --name description_of_changes
```

**View database in browser**:
```bash
npx prisma studio
```

**Reset database** (WARNING: deletes all data):
```bash
npx prisma migrate reset
```

## Monitoring & Observability

### Structured Logging

All logs are JSON-formatted (production) or pretty-printed (development).

Every request logs:
- Timestamp
- Request method and URL
- `X-Request-Id` (if present)
- `Idempotency-Key` (if present)
- Lead ID
- Operation outcome

**Errors include**:
- Full stack trace
- Request context
- Database error details
- Never leaked to client (security)

### Log Levels

Set via `LOG_LEVEL` environment variable:
- `trace` - Very verbose
- `debug` - Debug information
- `info` - General information (default)
- `warn` - Warnings
- `error` - Errors
- `fatal` - Fatal errors

## Production Deployment

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string

Optional:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production/development)
- `LOG_LEVEL` - Logging level (default: info)

### Database Connection Pooling

Prisma manages connection pooling automatically. For high-traffic deployments, consider:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/leadcrm?schema=public&connection_limit=10"
```

### Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals:
1. Stops accepting new requests
2. Completes in-flight requests
3. Closes database connections
4. Exits cleanly

### Health Checks

Use `GET /health` for:
- Container health checks
- Load balancer health checks
- Uptime monitoring

## Security Considerations

- **No Data Validation**: By design - accept all incoming data
- **SQL Injection**: Protected by Prisma (parameterized queries)
- **Error Information**: Never leak internal errors to clients
- **CORS**: Configured to allow all origins (adjust for production)
- **Rate Limiting**: Not implemented (add if needed)

## Troubleshooting

### Server won't start

Check:
1. Database is running and accessible
2. `DATABASE_URL` is correct in `.env`
3. Migrations are applied: `npx prisma migrate dev`
4. Port is not in use

### Database connection errors

```bash
# Test connection
npx prisma db pull

# View connection details (sanitized)
npm run dev
# Check logs for database URL
```

### Migration issues

```bash
# Reset and reapply all migrations
npx prisma migrate reset

# Create new migration
npx prisma migrate dev
```

## Testing Lead Ingestion

Using `curl`:

```bash
curl -X POST http://localhost:3000/api/lead \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-123" \
  -H "X-Request-Id: req-123" \
  -d '{
    "click_id": "12345",
    "country": "LV",
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+371123456789",
    "lang": "lv",
    "marker": "Pureshka",
    "offer": "Baltic Capital Native",
    "sourcetype": "web"
  }'
```

Run twice with same `Idempotency-Key` to test deduplication - second request returns 409.

## License

MIT

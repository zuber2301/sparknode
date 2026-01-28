# SparkNode - Employee Rewards & Recognition Platform

An enterprise-grade employee rewards and recognition platform with multi-tenant architecture, controlled budget flows, social recognition, and wallet-based accounting.

![SparkNode](https://img.shields.io/badge/SparkNode-R%26R%20Platform-purple)
![Docker](https://img.shields.io/badge/Docker-Containerized-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688)

## Features

### Core Capabilities
- **Multi-Tenant Architecture**: Complete data isolation per organization
- **Budget Management**: Fiscal year budgets with department allocations and monthly caps
- **Peer Recognition**: Social recognition with badges, points, and reactions
- **Wallet System**: Immutable ledger-based accounting for all point transactions
- **Rewards Marketplace**: Brand vouchers and gift cards redemption
- **Social Feed**: Company-wide recognition feed with comments and reactions
- **Audit Trail**: Complete logging of all administrative actions

### User Roles
- **Platform Admin**: Multi-tenant management (future feature)
- **HR Admin**: Budget management, user management, audit access
- **Manager**: Team recognition, department budget visibility
- **Employee**: Give/receive recognition, redeem rewards

## Tech Stack

### Frontend
- Vite + React 18 (JavaScript)
- TailwindCSS for styling
- React Router 6 for navigation
- TanStack Query for server state
- Zustand for client state
- Axios for API calls
- React Hot Toast for notifications

### Backend
- Python 3.11 with FastAPI
- SQLAlchemy 2.0 ORM
- PostgreSQL 15 database
- JWT authentication
- Pydantic for validation

### Infrastructure
- Docker & Docker Compose
- PostgreSQL with JSONB support

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Ports 5180, 8010, 5433 available

### Running the Application

1. Clone and navigate to the project:
```bash
cd sparknode
```

2. Start all services:
```bash
docker-compose up -d
```

3. Access the application:
- Frontend: http://localhost:5180
- Backend API: http://localhost:8010
- API Docs: http://localhost:8010/docs

### Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@demo.com | password123 | HR Admin |
| manager@demo.com | password123 | Manager |
| employee@demo.com | password123 | Employee |
| sarah@demo.com | password123 | Employee |
| mike@demo.com | password123 | Manager |

## Project Structure

```
sparknode/
├── docker-compose.yml          # Docker orchestration
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI application
│   ├── config.py               # Configuration settings
│   ├── database.py             # Database connection
│   ├── models.py               # SQLAlchemy models
│   ├── auth/                   # Authentication module
│   ├── users/                  # User management
│   ├── tenants/                # Tenant management
│   ├── budgets/                # Budget management
│   ├── wallets/                # Wallet & ledger
│   ├── recognition/            # Recognition & badges
│   ├── redemption/             # Rewards & vouchers
│   ├── feed/                   # Social feed
│   ├── notifications/          # Notifications
│   └── audit/                  # Audit logging
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── lib/
│       │   └── api.js          # API client
│       ├── store/
│       │   └── authStore.js    # Auth state
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── WalletBalance.jsx
│       │   ├── FeedCard.jsx
│       │   ├── RecognitionModal.jsx
│       │   ├── RewardsCatalog.jsx
│       │   └── RedemptionHistory.jsx
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Feed.jsx
│           ├── Recognize.jsx
│           ├── Redeem.jsx
│           ├── Wallet.jsx
│           ├── Budgets.jsx
│           ├── Users.jsx
│           ├── Audit.jsx
│           └── Profile.jsx
└── database/
    └── init.sql                # Schema & seed data
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/{id}` - Get user
- `PUT /api/users/{id}` - Update user

### Wallets
- `GET /api/wallets/me` - Get my wallet
- `GET /api/wallets/me/ledger` - Get my transactions
- `POST /api/wallets/allocate` - Allocate points

### Recognition
- `POST /api/recognitions` - Give recognition
- `GET /api/recognitions` - List recognitions
- `GET /api/recognitions/badges` - Get badges
- `POST /api/recognitions/{id}/react` - React to recognition
- `POST /api/recognitions/{id}/comments` - Add comment

### Redemption
- `GET /api/redemptions/vouchers` - Get available vouchers
- `POST /api/redemptions` - Redeem voucher
- `GET /api/redemptions` - Get my redemptions

### Budgets
- `GET /api/budgets` - List budgets
- `POST /api/budgets` - Create budget
- `POST /api/budgets/{id}/allocate` - Allocate to department

### Feed
- `GET /api/feed` - Get social feed

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/{id}/read` - Mark as read

### Audit
- `GET /api/audit` - Get audit logs (HR Admin only)

## Development

### Running in Development Mode

```bash
# Start all services with live reload
docker-compose up

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild after changes
docker-compose up --build
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it sparknode-db psql -U sparknode

# Common queries
SELECT * FROM users;
SELECT * FROM recognitions;
SELECT * FROM wallet_ledger;
```

## Architecture Notes

### Wallet Ledger Pattern
All point transactions are recorded as immutable ledger entries:
- `credit` - Points added (recognition received, allocation)
- `debit` - Points spent (recognition given, redemption)

### Budget Flow
1. HR creates fiscal budget
2. Budget allocated to departments
3. Managers give recognition (debits department budget)
4. Recipients receive points (credits their wallet)

### Multi-Tenant Isolation
- All tables include `tenant_id`
- API enforces tenant boundaries via JWT claims
- Database queries filtered by tenant

## License

MIT License - feel free to use this for your organization!

---

Built with ❤️ by the SparkNode Team

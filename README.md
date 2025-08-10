# PMEX CS Team Performance Tracker

A comprehensive web application for PMEX brokerage CS team to track client performance, NOTs (Number of Trades), and team targets.

## Features

### 🎯 Core Functionality
- **Client Management**: Add, edit, and track client information
- **Daily Transactions**: Record margin additions, withdrawals, and commissions
- **NOTs Calculation**: Automatic calculation (6000 PKR = 1 NOT)
- **Target Tracking**: 18% equity-based monthly targets
- **Working Days**: Excludes weekends from calculations

### 📊 Dashboard & Analytics
- Real-time performance metrics
- Daily, weekly, and monthly NOTs tracking
- Retention rate and trade rate analysis
- Client activity monitoring
- Performance trends and insights

### 🔐 Security & Authentication
- Google OAuth integration
- Admin-only data modification
- Row Level Security (RLS) on all tables
- Secure API endpoints

## Quick Setup

### 1. Environment Setup
Create a `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
The migrations will automatically create all necessary tables, views, and functions in your Supabase database.

### 4. Run the Application
```bash
npm run dev
```

## Database Schema

### Tables
- `clients` - Client information and current balances
- `daily_transactions` - Daily margin/withdrawal/commission records
- `daily_nots_tracking` - Daily NOTs achievement tracking
- `client_activity` - Client trading activity logs
- `products` - Trading products and commission rates
- `monthly_performance` - Historical monthly performance
- `team_settings` - Configurable team settings

### Key Functions
- `add_daily_transaction()` - Process daily transactions with NOTs calculation
- `calculate_equity_based_target()` - Calculate 18% equity targets
- `get_retention_metrics()` - Calculate retention and trade rates
- `get_working_days_in_month()` - Working days calculation

## Usage

### For CS Team Members
1. **View Dashboard**: Monitor daily performance and targets
2. **Check Analytics**: Analyze performance trends and metrics
3. **Browse Clients**: View client information and activity

### For Administrators
1. **Manage Clients**: Add new clients and edit existing ones
2. **Record Transactions**: Add daily margins, withdrawals, and commissions
3. **Track Performance**: Monitor team progress against targets
4. **Analyze Data**: Use analytics for performance insights

## Key Metrics

- **NOTs**: Number of Trades (6000 PKR commission = 1 NOT)
- **Target**: 18% of total client equity per month
- **Working Days**: Monday to Friday only
- **Retention Rate**: Percentage of active clients
- **Trade Rate**: Average trades per client

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Database & Authentication)
- React Query (Data fetching)
- React Hook Form (Form handling)
- Date-fns (Date utilities)

## Admin Configuration

The application uses email-based admin authentication. Update the admin email in the database policies:

```sql
-- Update admin email in all policies
auth.jwt() ->> 'email' = 'your-admin-email@company.com'
```

## Support

For technical support or feature requests, please contact the development team.

---

**Built for PMEX Brokerage CS Team** 🚀
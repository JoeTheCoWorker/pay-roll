# 💰 Payroll Bot

A powerful Towns Protocol bot that automates monthly payouts from a space's treasury wallet to members with specific roles. Built with TypeScript and the Towns Protocol bot framework.

## 🎯 Features

- **💰 Role-Based Payouts**: Configure different payout amounts for different roles
- **📅 Automatic Scheduling**: Monthly payouts run automatically (checks hourly)
- **🔧 Manual Triggers**: Admins can trigger payouts immediately via slash commands
- **💎 Multi-Token Support**: Distribute native ETH or ERC20 tokens
- **⚡ Batch Transfers**: Gas-efficient single-transaction payouts using ERC-7821
- **🔒 Admin-Only Security**: All configuration requires space admin permissions
- **📊 Notifications**: Automatic payout status notifications
- **🛡️ Type-Safe**: Built with TypeScript for reliability

## 📋 Prerequisites

- Node.js 18+ or Bun runtime
- Towns Protocol bot credentials (APP_PRIVATE_DATA and JWT_SECRET)
- Treasury wallet with sufficient funds
- Bot must have permission to execute transfers from treasury

## 🚀 Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment Variables

Copy `.env.sample` to `.env` and fill in your credentials:

```bash
cp .env.sample .env
```

Edit `.env`:
```
APP_PRIVATE_DATA=your_app_private_data_here
JWT_SECRET=your_jwt_secret_here
PORT=5123
```

### 3. Start the Bot

```bash
# Development mode (with hot reload)
bun run dev

# Production mode
bun run start
```

## 📖 Commands

### Admin Commands

All admin commands require space admin permissions.

- `/config` - View current payroll configuration
- `/set-treasury <address>` - Set treasury wallet address
- `/set-token <ETH|0x...>` - Set default payout token (ETH or ERC20 contract address)
- `/set-role <roleId> <amount>` - Set payout amount for a specific role
- `/enable` - Enable automatic monthly payouts
- `/disable` - Disable automatic monthly payouts
- `/payout` - Trigger manual payout immediately
- `/set-notification-channel` - Set channel for payout notifications

### Public Commands

- `/help` - Show help message with all available commands
- `/status` - Show current payroll configuration and status
- `/history` - Show payout history (last 10 payouts)

## 🔧 Configuration Workflow

1. **Set Treasury Address**
   ```
   /set-treasury 0x1234567890123456789012345678901234567890
   ```

2. **Set Default Token** (optional, defaults to ETH)
   ```
   /set-token ETH
   # or for ERC20:
   /set-token 0xABCDEF1234567890ABCDEF1234567890ABCDEF12
   ```

3. **Configure Role Payouts**
   ```
   /set-role admin 1.0
   /set-role contributor 0.5
   /set-role member 0.1
   ```

4. **Set Notification Channel** (optional)
   ```
   /set-notification-channel
   ```
   (Run this command in the channel where you want notifications)

5. **Enable Automatic Payouts**
   ```
   /enable
   ```

## 💡 How It Works

### Automatic Scheduling

The bot checks hourly if it's time for monthly payouts. A payout runs if:
- Payouts are enabled
- 30+ days have passed since the last payout
- Treasury address is configured
- At least one role payout is configured

### Batch Transfers

The bot uses ERC-7821 for gas-efficient batch transfers:
- All payouts in a single transaction
- Supports both ETH and ERC20 tokens
- Atomic execution (all succeed or all fail)

### Role-Based Payouts

Currently, the bot pays all space members based on configured role payouts. You can:
- Set different amounts for different roles
- Configure multiple roles per space
- Use different tokens per role

**Note**: The current implementation uses a simplified role checking approach. You may need to enhance the `payout.ts` file to check actual role membership from the Towns Protocol membership data structure.

## 🔐 Security

- All configuration commands require space admin permissions
- Treasury address must be explicitly set by an admin
- Payouts can be disabled at any time
- All actions are logged to payout history

## 📝 Important Notes

### Treasury Access

The bot needs to be able to execute transfers. This typically means:
- The bot's wallet must have funds (if paying from bot wallet), OR
- The treasury wallet must delegate transfer permissions to the bot, OR
- The bot must have access to a multi-sig or treasury contract

Adjust the payout execution logic in `src/payout.ts` based on your treasury setup.

### Role Membership

The current implementation uses a simplified role checking approach. To use actual role membership:

1. Check the structure of `member` objects from `bot.snapshot.getSpaceMemberships()`
2. Update the role checking logic in `src/payout.ts` around line 60-80
3. Use the actual role membership data (e.g., `member.roles`, `member.permissions`, etc.)

### Storage

This bot uses in-memory storage (Maps) which is suitable for always-on servers. For production:
- Consider using a database (SQLite, PostgreSQL) for persistence
- Implement backup/restore functionality
- Add configuration validation

## 🛠️ Development

### Project Structure

```
src/
├── index.ts          # Main bot file with command handlers
├── commands.ts       # Slash command definitions
├── types.ts          # TypeScript type definitions
├── storage.ts        # Configuration and history storage
├── payout.ts         # Payout execution logic
└── scheduler.ts      # Monthly payout scheduler
```

### Building

```bash
bun run build
```

### Type Checking

```bash
bun run typecheck
```

### Linting

```bash
bun run lint
```

## 📚 Resources

- [Towns Protocol Documentation](https://docs.towns.com)
- [Towns Protocol Bot Framework](https://docs.towns.com/build/bots/introduction)
- [ERC-7821 Specification](https://eips.ethereum.org/EIPS/eip-7821)

## 🤝 Contributing

This is a template bot. Feel free to:
- Enhance role membership checking
- Add database persistence
- Implement treasury delegation
- Add more features

## 📄 License

MIT

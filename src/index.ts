import { makeTownsBot } from '@towns-protocol/bot'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { parseEther, parseUnits } from 'viem'
import commands from './commands'
import { getSpaceConfig, saveSpaceConfig, getPayoutHistory } from './storage'
import { executePayout, formatAmount } from './payout'
import { startScheduler } from './scheduler'
import type { TokenType } from './types'

const bot = await makeTownsBot(process.env.APP_PRIVATE_DATA!, process.env.JWT_SECRET!, {
    commands,
})

// Helper function to check admin permission
async function requireAdmin(handler: any, userId: string, spaceId: string): Promise<boolean> {
    const isAdmin = await handler.hasAdminPermission(userId, spaceId)
    if (!isAdmin) {
        return false
    }
    return true
}

// Start the scheduler
const { jwtMiddleware, handler } = bot.start()
startScheduler(bot, bot.viem, bot.appAddress)

// Help command
bot.onSlashCommand('help', async (handler, { channelId }) => {
    await handler.sendMessage(
        channelId,
        '**💰 Payroll Bot Commands**\n\n' +
            '**Admin Commands:**\n' +
            '• `/config` - View current configuration\n' +
            '• `/set_treasury <address>` - Set treasury wallet address\n' +
            '• `/set_token <ETH|0x...>` - Set payout token (ETH or ERC20 address)\n' +
            '• `/set_role <roleId> <amount>` - Set payout amount for a role\n' +
            '• `/enable` - Enable automatic monthly payouts\n' +
            '• `/disable` - Disable automatic monthly payouts\n' +
            '• `/payout` - Trigger manual payout immediately\n' +
            '• `/set_notification_channel` - Set channel for payout notifications\n\n' +
            '**Public Commands:**\n' +
            '• `/status` - Show current payroll configuration\n' +
            '• `/history` - Show payout history\n\n' +
            '**Features:**\n' +
            '• Role-based payouts with different amounts per role\n' +
            '• Automatic monthly scheduling (checks hourly)\n' +
            '• Manual trigger support\n' +
            '• Multi-token support (ETH and ERC20)\n' +
            '• Gas-efficient batch transfers using ERC-7821',
    )
})

// Config command
bot.onSlashCommand('config', async (handler, { channelId, spaceId, userId }) => {
    if (!(await requireAdmin(handler, userId, spaceId))) {
        await handler.sendMessage(channelId, '❌ You must be a space admin to use this command.')
        return
    }

    const config = getSpaceConfig(spaceId)
    const rolePayoutsList = Array.from(config.rolePayouts.entries())
        .map(([roleId, roleConfig]) => `  • Role ${roleId}: ${formatAmount(roleConfig.amount, roleConfig.token)}`)
        .join('\n') || '  • No role payouts configured'

    await handler.sendMessage(
        channelId,
        '**📊 Current Configuration**\n\n' +
            `• Treasury: ${config.treasuryAddress}\n` +
            `• Default Token: ${config.token}\n` +
            `• Enabled: ${config.enabled ? '✅ Yes' : '❌ No'}\n` +
            `• Last Payout: ${config.lastPayoutDate ? config.lastPayoutDate.toLocaleString() : 'Never'}\n` +
            `• Notification Channel: ${config.notificationChannelId || 'Not set'}\n\n` +
            '**Role Payouts:**\n' +
            rolePayoutsList,
    )
})

// Set treasury command
bot.onSlashCommand('set_treasury', async (handler, { channelId, spaceId, userId, args }) => {
    if (!(await requireAdmin(handler, userId, spaceId))) {
        await handler.sendMessage(channelId, '❌ You must be a space admin to use this command.')
        return
    }

    if (args.length === 0) {
        await handler.sendMessage(channelId, 'Usage: `/set_treasury <wallet_address>`')
        return
    }

    const address = args[0] as `0x${string}`
    if (!address.startsWith('0x') || address.length !== 42) {
        await handler.sendMessage(channelId, '❌ Invalid wallet address. Must be a valid Ethereum address (0x...).')
        return
    }

    const config = getSpaceConfig(spaceId)
    config.treasuryAddress = address
    saveSpaceConfig(config)

    await handler.sendMessage(channelId, `✅ Treasury address set to: ${address}`)
})

// Set token command
bot.onSlashCommand('set_token', async (handler, { channelId, spaceId, userId, args }) => {
    if (!(await requireAdmin(handler, userId, spaceId))) {
        await handler.sendMessage(channelId, '❌ You must be a space admin to use this command.')
        return
    }

    if (args.length === 0) {
        await handler.sendMessage(channelId, 'Usage: `/set_token <ETH|0x...>`')
        return
    }

    const token = args[0].toUpperCase()
    let tokenType: TokenType

    if (token === 'ETH') {
        tokenType = 'ETH'
    } else if (token.startsWith('0X') && token.length === 42) {
        tokenType = token.toLowerCase() as `0x${string}`
    } else {
        await handler.sendMessage(
            channelId,
            '❌ Invalid token. Use "ETH" for native ETH or a valid ERC20 contract address (0x...).',
        )
        return
    }

    const config = getSpaceConfig(spaceId)
    config.token = tokenType
    saveSpaceConfig(config)

    await handler.sendMessage(channelId, `✅ Default token set to: ${tokenType}`)
})

// Set role payout command
bot.onSlashCommand('set_role', async (handler, { channelId, spaceId, userId, args }) => {
    if (!(await requireAdmin(handler, userId, spaceId))) {
        await handler.sendMessage(channelId, '❌ You must be a space admin to use this command.')
        return
    }

    if (args.length < 2) {
        await handler.sendMessage(channelId, 'Usage: `/set_role <roleId> <amount>`')
        return
    }

    const roleId = args[0]
    const amountStr = args[1]

    let amount: bigint
    try {
        amount = parseEther(amountStr)
    } catch {
        await handler.sendMessage(channelId, '❌ Invalid amount. Must be a valid number.')
        return
    }

    const config = getSpaceConfig(spaceId)
    if (!config.rolePayouts.has(roleId)) {
        config.rolePayouts.set(roleId, {
            roleId,
            amount: 0n,
            token: config.token,
        })
    }

    const roleConfig = config.rolePayouts.get(roleId)!
    roleConfig.amount = amount
    roleConfig.token = config.token // Use default token for this role
    saveSpaceConfig(config)

    await handler.sendMessage(
        channelId,
        `✅ Payout for role "${roleId}" set to ${formatAmount(amount, config.token)}`,
    )
})

// Enable command
bot.onSlashCommand('enable', async (handler, { channelId, spaceId, userId }) => {
    if (!(await requireAdmin(handler, userId, spaceId))) {
        await handler.sendMessage(channelId, '❌ You must be a space admin to use this command.')
        return
    }

    const config = getSpaceConfig(spaceId)
    if (!config.treasuryAddress || config.treasuryAddress === '0x0000000000000000000000000000000000000000') {
        await handler.sendMessage(
            channelId,
            '❌ Please set a treasury address first using `/set_treasury <address>`',
        )
        return
    }

    config.enabled = true
    saveSpaceConfig(config)

    await handler.sendMessage(channelId, '✅ Automatic monthly payouts enabled!')
})

// Disable command
bot.onSlashCommand('disable', async (handler, { channelId, spaceId, userId }) => {
    if (!(await requireAdmin(handler, userId, spaceId))) {
        await handler.sendMessage(channelId, '❌ You must be a space admin to use this command.')
        return
    }

    const config = getSpaceConfig(spaceId)
    config.enabled = false
    saveSpaceConfig(config)

    await handler.sendMessage(channelId, '❌ Automatic monthly payouts disabled.')
})

// Manual payout command
bot.onSlashCommand('payout', async (handler, { channelId, spaceId, userId }) => {
    if (!(await requireAdmin(handler, userId, spaceId))) {
        await handler.sendMessage(channelId, '❌ You must be a space admin to use this command.')
        return
    }

    await handler.sendMessage(channelId, '⏳ Processing payout... This may take a moment.')

    try {
        const result = await executePayout(bot, spaceId, bot.viem, bot.appAddress)

        if (result.success) {
            await handler.sendMessage(
                channelId,
                `✅ **Payout Complete!**\n\n` +
                    `• Recipients: ${result.recipients}\n` +
                    `• Total Amount: ${formatAmount(result.totalAmount, getSpaceConfig(spaceId).token)}\n` +
                    `• Transaction: ${result.transactionHash}\n` +
                    `• Time: ${result.timestamp.toLocaleString()}`,
            )
        } else {
            await handler.sendMessage(
                channelId,
                `❌ **Payout Failed**\n\nError: ${result.error}\n\nTime: ${result.timestamp.toLocaleString()}`,
            )
        }
    } catch (error: any) {
        await handler.sendMessage(channelId, `❌ Error executing payout: ${error.message || 'Unknown error'}`)
    }
})

// Status command
bot.onSlashCommand('status', async (handler, { channelId, spaceId }) => {
    const config = getSpaceConfig(spaceId)
    const rolePayoutsList = Array.from(config.rolePayouts.entries())
        .map(([roleId, roleConfig]) => `  • Role ${roleId}: ${formatAmount(roleConfig.amount, roleConfig.token)}`)
        .join('\n') || '  • No role payouts configured'

    const nextPayout = config.lastPayoutDate
        ? new Date(config.lastPayoutDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        : null

    await handler.sendMessage(
        channelId,
        '**📊 Payroll Status**\n\n' +
            `• Status: ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
            `• Treasury: ${config.treasuryAddress}\n` +
            `• Token: ${config.token}\n` +
            `• Last Payout: ${config.lastPayoutDate ? config.lastPayoutDate.toLocaleString() : 'Never'}\n` +
            `• Next Scheduled: ${nextPayout ? nextPayout.toLocaleString() : 'Not scheduled'}\n\n` +
            '**Role Payouts:**\n' +
            rolePayoutsList,
    )
})

// History command
bot.onSlashCommand('history', async (handler, { channelId, spaceId }) => {
    const history = getPayoutHistory(spaceId)

    if (history.length === 0) {
        await handler.sendMessage(channelId, '📜 No payout history found.')
        return
    }

    const recent = history.slice(-10).reverse() // Last 10 payouts, most recent first
    const config = getSpaceConfig(spaceId)

    const historyText =
        '**📜 Payout History (Last 10)**\n\n' +
        recent
            .map((record, idx) => {
                const status = record.result.success ? '✅' : '❌'
                const txHash = record.result.transactionHash
                    ? `\n   Tx: ${record.result.transactionHash}`
                    : ''
                const error = record.result.error ? `\n   Error: ${record.result.error}` : ''

                return (
                    `${status} **${record.payoutDate.toLocaleString()}**\n` +
                    `   Recipients: ${record.result.recipients}\n` +
                    `   Amount: ${formatAmount(record.result.totalAmount, config.token)}${txHash}${error}`
                )
            })
            .join('\n\n')

    await handler.sendMessage(channelId, historyText)
})

// Set notification channel command
bot.onSlashCommand('set_notification_channel', async (handler, { channelId, spaceId, userId }) => {
    if (!(await requireAdmin(handler, userId, spaceId))) {
        await handler.sendMessage(channelId, '❌ You must be a space admin to use this command.')
        return
    }

    const config = getSpaceConfig(spaceId)
    config.notificationChannelId = channelId
    saveSpaceConfig(config)

    await handler.sendMessage(
        channelId,
        `✅ Payout notifications will be sent to this channel.\n\n` +
            `You'll receive notifications when:\n` +
            `• Monthly payouts complete (success or failure)\n` +
            `• Manual payouts are triggered\n` +
            `• Payout errors occur`,
    )
})

const app = new Hono()
app.use(logger())
app.post('/webhook', jwtMiddleware, handler)

export default app

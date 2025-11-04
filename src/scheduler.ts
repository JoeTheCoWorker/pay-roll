/**
 * Monthly payout scheduler
 * Checks hourly if it's time for monthly payouts
 */

import type { BotHandler } from '@towns-protocol/bot'
import { spaceConfigs, getSpaceConfig } from './storage'
import { executePayout } from './payout'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Check if a month has passed since last payout
 */
function shouldRunPayout(lastPayoutDate: Date | null): boolean {
    if (!lastPayoutDate) {
        return true // Never run before
    }

    const now = new Date()
    const diffMs = now.getTime() - lastPayoutDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    return diffDays >= 30 // Run if 30+ days have passed
}

/**
 * Start the scheduler that checks hourly for payout eligibility
 */
export function startScheduler(
    bot: any, // TownsBot type - using any for now
    botViem: any,
    botAppAddress: `0x${string}`,
): void {
    setInterval(async () => {
        for (const [spaceId, config] of spaceConfigs) {
            if (!config.enabled) {
                continue
            }

            if (shouldRunPayout(config.lastPayoutDate)) {
                try {
                    // Create a minimal handler for executePayout
                    // We'll need to pass bot instead of handler
                    const result = await executePayout(bot, spaceId, botViem, botAppAddress)

                    // Send notification if channel is configured
                    if (config.notificationChannelId) {
                        const configToken = getSpaceConfig(spaceId).token
                        const { formatAmount } = await import('./payout')
                        
                        if (result.success) {
                            await bot.sendMessage(
                                config.notificationChannelId,
                                `✅ **Monthly Payout Complete**\n\n` +
                                    `• Recipients: ${result.recipients}\n` +
                                    `• Total Amount: ${formatAmount(result.totalAmount, configToken)}\n` +
                                    `• Transaction: ${result.transactionHash}\n` +
                                    `• Date: ${result.timestamp.toLocaleString()}`,
                            )
                        } else {
                            await bot.sendMessage(
                                config.notificationChannelId,
                                `❌ **Monthly Payout Failed**\n\n` +
                                    `• Error: ${result.error}\n` +
                                    `• Date: ${result.timestamp.toLocaleString()}`,
                            )
                        }
                    }
                } catch (error: any) {
                    console.error(`Error executing payout for space ${spaceId}:`, error)
                    
                    if (config.notificationChannelId) {
                        await bot.sendMessage(
                            config.notificationChannelId,
                            `❌ **Payout Error**\n\nError: ${error.message || 'Unknown error'}`,
                        )
                    }
                }
            }
        }
    }, CHECK_INTERVAL_MS)

    console.log('Payout scheduler started (checking hourly)')
}


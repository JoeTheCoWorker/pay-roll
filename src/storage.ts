/**
 * Storage layer for payroll bot configuration and history
 * Uses in-memory Maps for simplicity (suitable for always-on servers)
 */

import type { SpaceConfig, PayoutRecord } from './types'

// Space configuration storage: spaceId -> SpaceConfig
export const spaceConfigs = new Map<string, SpaceConfig>()

// Payout history: spaceId -> PayoutRecord[]
export const payoutHistory = new Map<string, PayoutRecord[]>()

/**
 * Get or create a space configuration
 */
export function getSpaceConfig(spaceId: string): SpaceConfig {
    if (!spaceConfigs.has(spaceId)) {
        spaceConfigs.set(spaceId, {
            spaceId,
            treasuryAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            token: 'ETH',
            rolePayouts: new Map(),
            lastPayoutDate: null,
            notificationChannelId: null,
            enabled: false,
        })
    }
    return spaceConfigs.get(spaceId)!
}

/**
 * Save space configuration
 */
export function saveSpaceConfig(config: SpaceConfig): void {
    spaceConfigs.set(config.spaceId, config)
}

// Re-export for convenience
export { saveSpaceConfig as setSpaceConfig }

/**
 * Add payout record to history
 */
export function addPayoutRecord(spaceId: string, record: PayoutRecord): void {
    const history = payoutHistory.get(spaceId) || []
    history.push(record)
    payoutHistory.set(spaceId, history)
}

/**
 * Get payout history for a space
 */
export function getPayoutHistory(spaceId: string): PayoutRecord[] {
    return payoutHistory.get(spaceId) || []
}


/**
 * Type definitions for the payroll bot
 */

export type TokenType = 'ETH' | `0x${string}` // Native ETH or ERC20 contract address

export interface RolePayoutConfig {
    roleId: string
    amount: bigint // Amount in wei (or smallest unit for ERC20)
    token: TokenType
}

export interface SpaceConfig {
    spaceId: string
    treasuryAddress: `0x${string}` // Treasury wallet address
    token: TokenType // Default token for payouts
    rolePayouts: Map<string, RolePayoutConfig> // roleId -> payout config
    lastPayoutDate: Date | null
    notificationChannelId: string | null
    enabled: boolean
}

export interface PayoutResult {
    success: boolean
    transactionHash?: string
    recipients: number
    totalAmount: bigint
    error?: string
    timestamp: Date
}

export interface PayoutRecord {
    spaceId: string
    payoutDate: Date
    result: PayoutResult
}


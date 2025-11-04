/**
 * Payout execution logic using ERC-7821 for batch transfers
 */

import { execute } from 'viem/experimental/erc7821'
import { waitForTransactionReceipt } from 'viem/actions'
import { parseEther, type Address, erc20Abi, parseUnits } from 'viem'
import type { SpaceConfig, PayoutResult, TokenType } from './types'
import { getSpaceConfig, addPayoutRecord, saveSpaceConfig } from './storage'

/**
 * Execute batch payout for a space
 */
export async function executePayout(
    bot: any, // TownsBot type - using any for now
    spaceId: string,
    botViem: any,
    botAppAddress: `0x${string}`,
): Promise<PayoutResult> {
    const config = getSpaceConfig(spaceId)

    if (!config.enabled) {
        return {
            success: false,
            error: 'Payouts are not enabled for this space',
            recipients: 0,
            totalAmount: 0n,
            timestamp: new Date(),
        }
    }

    if (!config.treasuryAddress || config.treasuryAddress === '0x0000000000000000000000000000000000000000') {
        return {
            success: false,
            error: 'Treasury address not configured',
            recipients: 0,
            totalAmount: 0n,
            timestamp: new Date(),
        }
    }

    // Get space memberships to determine eligible recipients
    const memberships = await bot.snapshot.getSpaceMemberships(spaceId)
    if (!memberships || memberships.length === 0) {
        return {
            success: false,
            error: 'No members found in space',
            recipients: 0,
            totalAmount: 0n,
            timestamp: new Date(),
        }
    }

    // Group members by role and calculate payouts
    const payoutMap = new Map<string, { address: `0x${string}`; amount: bigint; token: TokenType }>()

    for (const member of memberships) {
        const userId = member.userId as `0x${string}`
        
        // Check each role payout configuration
        // Note: This is a simplified implementation. In production, you should:
        // 1. Check actual role membership from member.roles or member.permissions
        // 2. Handle users with multiple roles (sum amounts or use highest, depending on your logic)
        // 3. Filter out bots or excluded addresses if needed
        
        // For now: pay all members the default role payout if configured
        // You can enhance this by checking member.roles or member.permissions
        // Example: if (member.roles?.includes(roleId)) { ... }
        
        let totalPayout = 0n
        let payoutToken: TokenType = config.token
        
        // Sum payouts from all roles this member has
        // TODO: Replace with actual role membership check
        for (const [roleId, roleConfig] of config.rolePayouts) {
            // Check if user has this role
            // This is a placeholder - adjust based on actual Towns Protocol membership structure
            const hasRole = true // TODO: Check member.roles?.includes(roleId) or similar
            
            if (hasRole && roleConfig.amount > 0n) {
                totalPayout += roleConfig.amount
                payoutToken = roleConfig.token // Use token from role config
            }
        }
        
        // If no role-specific payout, skip this member
        if (totalPayout > 0n) {
            payoutMap.set(userId, {
                address: userId,
                amount: totalPayout,
                token: payoutToken,
            })
        }
    }

    if (payoutMap.size === 0) {
        return {
            success: false,
            error: 'No eligible recipients found',
            recipients: 0,
            totalAmount: 0n,
            timestamp: new Date(),
        }
    }

    // Group payouts by token type
    const ethPayouts: Array<{ to: `0x${string}`; value: bigint }> = []
    const tokenPayouts = new Map<`0x${string}`, Array<{ to: `0x${string}`; amount: bigint }>>()

    for (const [address, payout] of payoutMap) {
        if (payout.token === 'ETH') {
            ethPayouts.push({ to: address as `0x${string}`, value: payout.amount })
        } else {
            const token = payout.token as `0x${string}`
            if (!tokenPayouts.has(token)) {
                tokenPayouts.set(token, [])
            }
            tokenPayouts.get(token)!.push({ to: address as `0x${string}`, amount: payout.amount })
        }
    }

    // Build batch calls for ERC-7821
    const calls: any[] = []

    // Add ETH transfers
    for (const payout of ethPayouts) {
        calls.push({
            to: payout.to,
            value: payout.value,
        })
    }

    // Add ERC20 transfers
    for (const [tokenAddress, payouts] of tokenPayouts) {
        for (const payout of payouts) {
            calls.push({
                to: tokenAddress as Address,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [payout.to, payout.amount],
            })
        }
    }

    if (calls.length === 0) {
        return {
            success: false,
            error: 'No valid payout calls to execute',
            recipients: 0,
            totalAmount: 0n,
            timestamp: new Date(),
        }
    }

    try {
        // Execute batch transfer
        const hash = await execute(botViem, {
            address: botAppAddress,
            account: botViem.account,
            calls,
            chain: botViem.chain,
        })

        // Wait for transaction confirmation
        await waitForTransactionReceipt(botViem, { hash })

        // Calculate total amount
        const totalAmount = Array.from(payoutMap.values()).reduce(
            (sum, payout) => sum + payout.amount,
            0n,
        )

        const result: PayoutResult = {
            success: true,
            transactionHash: hash,
            recipients: payoutMap.size,
            totalAmount,
            timestamp: new Date(),
        }

        // Update last payout date
        config.lastPayoutDate = new Date()
        saveSpaceConfig(config)

        // Record payout
        addPayoutRecord(spaceId, {
            spaceId,
            payoutDate: new Date(),
            result,
        })

        return result
    } catch (error: any) {
        const result: PayoutResult = {
            success: false,
            error: error.message || 'Unknown error during payout execution',
            recipients: 0,
            totalAmount: 0n,
            timestamp: new Date(),
        }

        // Record failed payout
        addPayoutRecord(spaceId, {
            spaceId,
            payoutDate: new Date(),
            result,
        })

        return result
    }
}

/**
 * Format amount for display
 */
export function formatAmount(amount: bigint, token: TokenType, decimals: number = 18): string {
    if (token === 'ETH') {
        const eth = Number(amount) / 1e18
        return `${eth.toFixed(6)} ETH`
    } else {
        const tokenAmount = Number(amount) / 10 ** decimals
        return `${tokenAmount.toFixed(6)} tokens`
    }
}


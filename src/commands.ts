import type { PlainMessage, SlashCommand } from '@towns-protocol/proto'

const commands = [
    {
        name: 'help',
        description: 'Show help message with all available commands',
    },
    {
        name: 'config',
        description: 'Configure payroll settings (admin only)',
    },
    {
        name: 'set_role',
        description: 'Set payout amount for a role (admin only)',
    },
    {
        name: 'set_treasury',
        description: 'Set treasury wallet address (admin only)',
    },
    {
        name: 'set_token',
        description: 'Set default payout token (ETH or ERC20 address) (admin only)',
    },
    {
        name: 'enable',
        description: 'Enable automatic monthly payouts (admin only)',
    },
    {
        name: 'disable',
        description: 'Disable automatic monthly payouts (admin only)',
    },
    {
        name: 'payout',
        description: 'Trigger manual payout immediately (admin only)',
    },
    {
        name: 'status',
        description: 'Show current payroll configuration and status',
    },
    {
        name: 'history',
        description: 'Show payout history',
    },
    {
        name: 'set_notification_channel',
        description: 'Set channel for payout notifications (admin only)',
    },
] as const satisfies PlainMessage<SlashCommand>[]

export default commands

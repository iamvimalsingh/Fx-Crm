<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Financial\WalletService;
use Illuminate\Console\Command;

class AuditWalletLedgerCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'wallet:audit {userId? : Optional User ID to audit}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Audit wallet cached available balances against immutable transaction ledger records';

    /**
     * Execute the console command.
     */
    public function handle(WalletService $walletService): int
    {
        $userId = $this->argument('userId');

        if ($userId) {
            $user = User::find($userId);
            if (!$user) {
                $this->error("User with ID [{$userId}] not found.");
                return self::FAILURE;
            }
            $users = collect([$user]);
        } else {
            $users = User::has('wallet')->get();
        }

        if ($users->isEmpty()) {
            $this->info('No wallets found to audit.');
            return self::SUCCESS;
        }

        $headers = ['User ID', 'Currency', 'Cached Balance', 'Ledger Net', 'Pending Reserved', 'Expected Available', 'Status'];
        $rows = [];
        $discrepancyCount = 0;

        foreach ($users as $user) {
            $audit = $walletService->recalculateBalance($user);

            $statusStr = $audit['is_synchronized'] ? '<fg=green>SYNCHRONIZED</>' : '<fg=red>DISCREPANCY</>';

            if (!$audit['is_synchronized']) {
                $discrepancyCount++;
            }

            $rows[] = [
                $audit['user_id'],
                $audit['currency'],
                '$' . $audit['cached_balance'],
                '$' . $audit['ledger_balance'],
                '$' . $audit['pending_reserved'],
                '$' . $audit['expected_available_balance'],
                $statusStr,
            ];
        }

        $this->table($headers, $rows);

        if ($discrepancyCount > 0) {
            $this->error("Audit Completed: Detected {$discrepancyCount} wallet ledger discrepancy(s).");
            return self::FAILURE;
        }

        $this->info('Audit Completed: All audited wallets are 100% synchronized with the ledger.');
        return self::SUCCESS;
    }
}

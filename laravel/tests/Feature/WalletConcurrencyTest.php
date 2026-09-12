<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\InsufficientFundsException;
use App\Models\User;
use App\Services\Financial\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WalletConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    private WalletService $walletService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->walletService = new WalletService();
    }

    /** @test */
    public function concurrent_debit_attempts_cannot_overspend_wallet()
    {
        $user = User::create([
            'email' => 'concurrent_' . uniqid() . '@example.com',
            'password' => bcrypt('password123'),
            'role' => UserRole::CLIENT,
            'status' => UserStatus::ACTIVE,
        ]);

        // Starting balance = 100.00
        $this->walletService->credit($user, '100.00');

        $successCount = 0;
        $insufficientCount = 0;

        // Simulate two sequential/competing debit attempts of 100.00 each
        for ($i = 0; $i < 2; $i++) {
            try {
                $this->walletService->debit($user, '100.00');
                $successCount++;
            } catch (InsufficientFundsException $e) {
                $insufficientCount++;
            }
        }

        // Exactly 1 debit succeeded and 1 failed due to insufficient funds
        $this->assertEquals(1, $successCount, 'Exactly one 100.00 debit must succeed');
        $this->assertEquals(1, $insufficientCount, 'Second 100.00 debit attempt must fail due to insufficient funds');
        $this->assertEquals('0.00', $user->fresh()->wallet->balance, 'Final wallet balance must be exactly 0.00');
    }

    /** @test */
    public function concurrent_withdrawal_reservations_cannot_overspend_wallet()
    {
        $user = User::create([
            'email' => 'concurrent_wd_' . uniqid() . '@example.com',
            'password' => bcrypt('password123'),
            'role' => UserRole::CLIENT,
            'status' => UserStatus::ACTIVE,
        ]);

        // Starting balance = 100.00
        $this->walletService->credit($user, '100.00');

        $successCount = 0;
        $insufficientCount = 0;

        // Attempt two 100.00 withdrawal reservations
        for ($i = 0; $i < 2; $i++) {
            try {
                $this->walletService->reserveForWithdrawal($user, '100.00', 'bank_wire', 'Bank Details');
                $successCount++;
            } catch (InsufficientFundsException $e) {
                $insufficientCount++;
            }
        }

        $this->assertEquals(1, $successCount, 'Exactly one withdrawal reservation must succeed');
        $this->assertEquals(1, $insufficientCount, 'Second reservation attempt must fail');
        $this->assertEquals('0.00', $user->fresh()->wallet->balance, 'Final wallet balance must be 0.00');
    }
}

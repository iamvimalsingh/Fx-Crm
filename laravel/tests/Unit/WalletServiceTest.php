<?php

namespace Tests\Unit;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\InsufficientFundsException;
use App\Models\User;
use App\Services\Financial\ReferenceGenerator;
use App\Services\Financial\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use LogicException;
use Tests\TestCase;

class WalletServiceTest extends TestCase
{
    use RefreshDatabase;

    private WalletService $walletService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->walletService = new WalletService();
    }

    private function createUser(): User
    {
        return User::create([
            'email' => 'client_' . uniqid() . '@example.com',
            'password' => bcrypt('password123'),
            'role' => UserRole::CLIENT,
            'status' => UserStatus::ACTIVE,
        ]);
    }

    /** @test */
    public function it_credits_wallet_successfully()
    {
        $user = $this->createUser();

        $transaction = $this->walletService->credit($user, '150.50', TransactionType::DEPOSIT, 'Test Deposit');

        $this->assertEquals('150.50', $transaction->amount);
        $this->assertEquals(TransactionStatus::COMPLETED, $transaction->status);
        $this->assertEquals('150.50', $user->fresh()->wallet->balance);
    }

    /** @test */
    public function it_debits_wallet_successfully()
    {
        $user = $this->createUser();
        $this->walletService->credit($user, '200.00');

        $transaction = $this->walletService->debit($user, '75.25', TransactionType::WITHDRAWAL, 'Test Debit');

        $this->assertEquals('75.25', $transaction->amount);
        $this->assertEquals(TransactionStatus::COMPLETED, $transaction->status);
        $this->assertEquals('124.75', $user->fresh()->wallet->balance);
    }

    /** @test */
    public function it_throws_insufficient_funds_exception_when_debiting_more_than_available()
    {
        $user = $this->createUser();
        $this->walletService->credit($user, '50.00');

        $this->expectException(InsufficientFundsException::class);

        $this->walletService->debit($user, '100.00');
    }

    /** @test */
    public function it_reserves_funds_for_pending_withdrawal()
    {
        $user = $this->createUser();
        $this->walletService->credit($user, '300.00');

        $transaction = $this->walletService->reserveForWithdrawal(
            $user,
            '100.00',
            'bank_wire',
            'IBAN: US1234567890'
        );

        $this->assertEquals('100.00', $transaction->amount);
        $this->assertEquals(TransactionStatus::PENDING, $transaction->status);
        // Wallet available balance reduced immediately to 200.00
        $this->assertEquals('200.00', $user->fresh()->wallet->balance);
        $this->assertNotNull($transaction->withdrawal);
        $this->assertEquals('bank_wire', $transaction->withdrawal->withdrawal_method);
    }

    /** @test */
    public function it_refunds_rejected_withdrawal_and_restores_balance()
    {
        $user = $this->createUser();
        $this->walletService->credit($user, '300.00');

        $pendingTx = $this->walletService->reserveForWithdrawal(
            $user,
            '100.00',
            'crypto',
            'USDT Address: 0x123'
        );

        $this->assertEquals('200.00', $user->fresh()->wallet->balance);

        $refundedTx = $this->walletService->refundWithdrawal($pendingTx, 'Invalid wallet address');

        $this->assertEquals(TransactionStatus::REJECTED, $refundedTx->status);
        // Balance restored back to 300.00
        $this->assertEquals('300.00', $user->fresh()->wallet->balance);
    }

    /** @test */
    public function it_prevents_duplicate_withdrawal_refunds()
    {
        $user = $this->createUser();
        $this->walletService->credit($user, '300.00');

        $pendingTx = $this->walletService->reserveForWithdrawal($user, '100.00', 'bank_wire', 'Details');

        // First refund succeeds
        $this->walletService->refundWithdrawal($pendingTx, 'First rejection');

        // Second refund attempt must fail with LogicException
        $this->expectException(LogicException::class);
        $this->walletService->refundWithdrawal($pendingTx, 'Second rejection attempt');
    }

    /** @test */
    public function it_audits_wallet_and_verifies_synchronization()
    {
        $user = $this->createUser();

        // Credit 500.00
        $this->walletService->credit($user, '500.00');

        // Pending withdrawal 100.00 (available = 400.00)
        $this->walletService->reserveForWithdrawal($user, '100.00', 'bank_wire', 'Details');

        $audit = $this->walletService->recalculateBalance($user);

        $this->assertEquals('400.00', $audit['cached_balance']);
        $this->assertEquals('500.00', $audit['ledger_balance']);
        $this->assertEquals('100.00', $audit['pending_reserved']);
        $this->assertEquals('400.00', $audit['expected_available_balance']);
        $this->assertTrue($audit['is_synchronized']);
    }

    /** @test */
    public function it_rejects_zero_or_negative_amounts()
    {
        $user = $this->createUser();

        $this->expectException(InvalidArgumentException::class);
        $this->walletService->credit($user, '0.00');
    }

    /** @test */
    public function it_generates_unique_transaction_references()
    {
        $ref1 = ReferenceGenerator::generate('TXN');
        $ref2 = ReferenceGenerator::generate('TXN');

        $this->assertNotEquals($ref1, $ref2);
        $this->assertStringStartsWith('TXN-', $ref1);
    }
}

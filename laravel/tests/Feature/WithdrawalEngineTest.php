<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Exceptions\InsufficientFundsException;
use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Withdrawal;
use App\Services\Financial\MoneyFormatter;
use App\Services\Financial\WalletService;
use App\Services\Financial\WithdrawalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use LogicException;
use Tests\TestCase;

class WithdrawalEngineTest extends TestCase
{
    use RefreshDatabase;

    protected WalletService $walletService;
    protected WithdrawalService $withdrawalService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->walletService = app(WalletService::class);
        $this->withdrawalService = app(WithdrawalService::class);
    }

    public function test_01_insufficient_balance_rejected(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '50.00']);

        $this->expectException(InsufficientFundsException::class);
        $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '100.00',
            method: 'bank_transfer',
            destinationDetails: 'IBAN US1234567890'
        );
    }

    public function test_02_valid_withdrawal_reserves_funds_immediately(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '500.00']);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '200.00',
            method: 'bank_transfer',
            destinationDetails: 'Account #12345678',
            clientNotes: 'Urgent transfer'
        );

        $this->assertEquals('pending', $withdrawal->status);
        $this->assertEquals('200.00', $withdrawal->amount);
        $this->assertEquals('bank_transfer', $withdrawal->withdrawal_method);
        $this->assertEquals('Account #12345678', $withdrawal->destination_details);
        $this->assertEquals('Urgent transfer', $withdrawal->client_notes);
        $this->assertNull($withdrawal->admin_notes);
        $this->assertNotNull($withdrawal->transaction_id);

        // Funds reserved immediately from wallet
        $this->assertEquals('300.00', $wallet->fresh()->balance);

        // Transaction is PENDING
        $txn = Transaction::find($withdrawal->transaction_id);
        $this->assertNotNull($txn);
        $this->assertEquals(TransactionType::WITHDRAWAL->value, $txn->type->value ?? $txn->type);
        $this->assertEquals(TransactionStatus::PENDING->value, $txn->status->value ?? $txn->status);
        $this->assertEquals('200.00', $txn->amount);

        // Audit log created
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'withdrawal_request_created',
            'user_id' => $client->id,
            'target_id' => $withdrawal->id,
        ]);
    }

    public function test_03_wallet_balance_decreases_exactly_once(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '1000.00']);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '400.00',
            method: 'usdt_trc20',
            destinationDetails: 'TRX789abc'
        );

        $this->assertEquals('600.00', $wallet->fresh()->balance);

        // Completion does NOT debit again
        $this->withdrawalService->complete($withdrawal, $admin, 'Processed via Binance');
        $this->assertEquals('600.00', $wallet->fresh()->balance);
    }

    public function test_04_zero_amount_rejected(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '1000.00']);

        $this->expectException(InvalidArgumentException::class);
        $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '0.00',
            method: 'bank_transfer',
            destinationDetails: 'IBAN US1234567890'
        );
    }

    public function test_05_negative_amount_rejected(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '1000.00']);

        $this->expectException(InvalidArgumentException::class);
        $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '-50.00',
            method: 'bank_transfer',
            destinationDetails: 'IBAN US1234567890'
        );
    }

    public function test_06_malformed_scientific_notation_amount_rejected(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '1000.00']);

        $this->expectException(InvalidArgumentException::class);
        $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '1e2',
            method: 'bank_transfer',
            destinationDetails: 'IBAN US1234567890'
        );
    }

    public function test_07_below_minimum_rejected(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '1000.00']);

        // Default min_withdrawal is 20.00; attempt 15.00
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Withdrawal amount must be at least');
        $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '15.00',
            method: 'bank_transfer',
            destinationDetails: 'IBAN US1234567890'
        );
    }

    public function test_08_above_maximum_rejected(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '100000.00']);

        // Default max_withdrawal is 25000.00; attempt 30000.00
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Withdrawal amount must not exceed');
        $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '30000.00',
            method: 'bank_transfer',
            destinationDetails: 'IBAN US1234567890'
        );
    }

    public function test_09_invalid_withdrawal_method_rejected(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '1000.00']);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid withdrawal method selected.');
        $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '100.00',
            method: 'invalid_unsupported_method',
            destinationDetails: 'Details'
        );
    }

    public function test_10_inactive_invalid_client_rejected(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $disabledClient = User::factory()->create(['role' => 'client', 'status' => 'disabled']);

        $this->expectException(InvalidArgumentException::class);
        $this->withdrawalService->createClientRequest(
            client: $admin,
            amount: '100.00',
            method: 'bank_transfer',
            destinationDetails: 'Details'
        );
    }

    public function test_11_client_cannot_cancel_another_clients_withdrawal(): void
    {
        $client1 = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $client2 = User::factory()->create(['role' => 'client', 'status' => 'active']);

        $wallet1 = $this->walletService->getWallet($client1);
        $wallet1->update(['balance' => '500.00']);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client1,
            amount: '100.00',
            method: 'bank_transfer',
            destinationDetails: 'Details'
        );

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('You are not authorized to cancel this withdrawal.');
        $this->withdrawalService->cancel($withdrawal, $client2);
    }

    public function test_12_pending_cancellation_refunds_exactly_once(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $this->walletService->credit($client, '500.00');
        $wallet = $this->walletService->getWallet($client);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '200.00',
            method: 'bank_transfer',
            destinationDetails: 'Details'
        );

        $this->assertEquals('300.00', $wallet->fresh()->balance);

        $cancelledWithdrawal = $this->withdrawalService->cancel($withdrawal, $client, 'Changed my mind');

        $this->assertEquals('cancelled', $cancelledWithdrawal->status);
        $this->assertEquals('500.00', $wallet->fresh()->balance);
        $this->assertNull($cancelledWithdrawal->refund_transaction_id);
        $this->assertNull($cancelledWithdrawal->processed_by_user_id);

        $reservationTx = Transaction::find($withdrawal->transaction_id);
        $this->assertEquals(TransactionStatus::CANCELLED->value, $reservationTx->status->value ?? $reservationTx->status);

        // Exactly 2 transactions: initial deposit + cancelled reservation
        $this->assertEquals(2, Transaction::where('user_id', $client->id)->count());

        // Audit synchronization
        $audit = $this->walletService->recalculateBalance($client);
        $this->assertTrue($audit['is_synchronized']);
        $this->assertEquals('500.00', $audit['expected_available_balance']);

        // Audit log verified
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'withdrawal_cancelled',
            'user_id' => $client->id,
            'target_id' => $withdrawal->id,
        ]);
    }

    public function test_13_admin_completion_changes_status_and_does_not_debit_wallet_again(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $this->walletService->credit($client, '800.00');
        $wallet = $this->walletService->getWallet($client);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '300.00',
            method: 'bank_transfer',
            destinationDetails: 'Details'
        );

        $this->assertEquals('500.00', $wallet->fresh()->balance);

        $completedWithdrawal = $this->withdrawalService->complete($withdrawal, $admin, 'Wire sent via Chase ref #9988');

        $this->assertEquals('completed', $completedWithdrawal->status);
        $this->assertEquals($admin->id, $completedWithdrawal->processed_by_user_id);
        $this->assertEquals('Wire sent via Chase ref #9988', $completedWithdrawal->admin_notes);
        $this->assertEquals('500.00', $wallet->fresh()->balance);

        $reservationTx = Transaction::find($withdrawal->transaction_id);
        $this->assertEquals(TransactionStatus::COMPLETED->value, $reservationTx->status->value ?? $reservationTx->status);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'withdrawal_completed',
            'user_id' => $admin->id,
            'target_id' => $withdrawal->id,
        ]);
    }

    public function test_14_admin_rejection_refunds_exactly_once(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $this->walletService->credit($client, '1000.00');
        $wallet = $this->walletService->getWallet($client);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '400.00',
            method: 'crypto',
            destinationDetails: 'BTC Address'
        );

        $this->assertEquals('600.00', $wallet->fresh()->balance);

        $rejectedWithdrawal = $this->withdrawalService->reject($withdrawal, $admin, 'Invalid crypto wallet address provided');

        $this->assertEquals('rejected', $rejectedWithdrawal->status);
        $this->assertEquals('1000.00', $wallet->fresh()->balance);
        $this->assertNull($rejectedWithdrawal->refund_transaction_id);
        $this->assertEquals($admin->id, $rejectedWithdrawal->processed_by_user_id);

        $reservationTx = Transaction::find($withdrawal->transaction_id);
        $this->assertEquals(TransactionStatus::REJECTED->value, $reservationTx->status->value ?? $reservationTx->status);

        // Exactly 2 transactions: initial deposit + rejected reservation
        $this->assertEquals(2, Transaction::where('user_id', $client->id)->count());

        // Audit synchronization
        $audit = $this->walletService->recalculateBalance($client);
        $this->assertTrue($audit['is_synchronized']);
        $this->assertEquals('1000.00', $audit['expected_available_balance']);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'withdrawal_rejected',
            'user_id' => $admin->id,
            'target_id' => $withdrawal->id,
        ]);
    }

    public function test_15_rejection_creates_no_extra_manual_credit_transaction(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $this->walletService->credit($client, '700.00');
        $wallet = $this->walletService->getWallet($client);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '250.00',
            method: 'bank_transfer',
            destinationDetails: 'IBAN US999'
        );

        $rejected = $this->withdrawalService->reject($withdrawal, $admin, 'Compliance hold');

        $this->assertNull($rejected->refund_transaction_id);
        $this->assertEquals('700.00', $wallet->fresh()->balance);

        $manualCredits = Transaction::where('user_id', $client->id)
            ->where('type', TransactionType::MANUAL_CREDIT->value)
            ->count();
        $this->assertEquals(0, $manualCredits);

        $audit = $this->walletService->recalculateBalance($client);
        $this->assertTrue($audit['is_synchronized']);
        $this->assertEquals('700.00', $audit['expected_available_balance']);
    }

    public function test_16_cancellation_creates_no_extra_manual_credit_transaction(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $this->walletService->credit($client, '600.00');
        $wallet = $this->walletService->getWallet($client);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '150.00',
            method: 'usdt_trc20',
            destinationDetails: 'TRX111222'
        );

        $cancelled = $this->withdrawalService->cancel($withdrawal, $client, 'User cancel');

        $this->assertNull($cancelled->refund_transaction_id);
        $this->assertNull($cancelled->processed_by_user_id);
        $this->assertEquals('600.00', $wallet->fresh()->balance);

        $manualCredits = Transaction::where('user_id', $client->id)
            ->where('type', TransactionType::MANUAL_CREDIT->value)
            ->count();
        $this->assertEquals(0, $manualCredits);

        $audit = $this->walletService->recalculateBalance($client);
        $this->assertTrue($audit['is_synchronized']);
        $this->assertEquals('600.00', $audit['expected_available_balance']);
    }

    public function test_17_refund_transaction_id_remains_null(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '500.00']);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '100.00',
            method: 'manual',
            destinationDetails: 'Cash office'
        );

        $this->assertNull($withdrawal->refund_transaction_id);

        $rejected = $this->withdrawalService->reject($withdrawal, $admin, 'Rejected');
        $this->assertNull($rejected->refund_transaction_id);
    }

    public function test_18_completed_withdrawal_cannot_be_rejected_cancelled_refunded(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '500.00']);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '100.00',
            method: 'bank_transfer',
            destinationDetails: 'Bank Details'
        );

        $this->withdrawalService->complete($withdrawal, $admin);

        // Attempt rejection
        try {
            $this->withdrawalService->reject($withdrawal, $admin, 'Try reject');
            $this->fail('Should not reject completed withdrawal');
        } catch (LogicException $e) {
            $this->assertStringContainsString('not pending', $e->getMessage());
        }

        // Attempt cancellation
        try {
            $this->withdrawalService->cancel($withdrawal, $client);
            $this->fail('Should not cancel completed withdrawal');
        } catch (LogicException $e) {
            $this->assertStringContainsString('not pending', $e->getMessage());
        }

        $this->assertEquals('400.00', $wallet->fresh()->balance);
    }

    public function test_19_rejected_withdrawal_cannot_be_processed_again(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '500.00']);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '100.00',
            method: 'bank_transfer',
            destinationDetails: 'Bank Details'
        );

        $this->withdrawalService->reject($withdrawal, $admin, 'First rejection');

        // Attempt complete
        try {
            $this->withdrawalService->complete($withdrawal, $admin);
            $this->fail('Should not complete rejected withdrawal');
        } catch (LogicException $e) {
            $this->assertStringContainsString('not pending', $e->getMessage());
        }

        // Attempt duplicate rejection
        try {
            $this->withdrawalService->reject($withdrawal, $admin, 'Second rejection');
            $this->fail('Should not reject already rejected withdrawal');
        } catch (LogicException $e) {
            $this->assertStringContainsString('not pending', $e->getMessage());
        }

        $this->assertEquals('500.00', $wallet->fresh()->balance);
    }

    public function test_20_cancelled_withdrawal_cannot_be_processed_again(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '500.00']);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '100.00',
            method: 'bank_transfer',
            destinationDetails: 'Bank Details'
        );

        $this->withdrawalService->cancel($withdrawal, $client);

        try {
            $this->withdrawalService->complete($withdrawal, $admin);
            $this->fail('Should not complete cancelled withdrawal');
        } catch (LogicException $e) {
            $this->assertStringContainsString('not pending', $e->getMessage());
        }

        try {
            $this->withdrawalService->cancel($withdrawal, $client);
            $this->fail('Should not cancel already cancelled withdrawal');
        } catch (LogicException $e) {
            $this->assertStringContainsString('not pending', $e->getMessage());
        }

        $this->assertEquals('500.00', $wallet->fresh()->balance);
    }

    public function test_21_concurrent_withdrawal_requests_cannot_overdraw_wallet(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '100.00']);

        $successCount = 0;
        $failedCount = 0;

        // Attempt two $80.00 withdrawals on a $100.00 wallet
        for ($i = 0; $i < 2; $i++) {
            try {
                $this->withdrawalService->createClientRequest(
                    client: $client,
                    amount: '80.00',
                    method: 'bank_transfer',
                    destinationDetails: 'Account Details'
                );
                $successCount++;
            } catch (InsufficientFundsException $e) {
                $failedCount++;
            }
        }

        $this->assertEquals(1, $successCount, 'Only one request can succeed');
        $this->assertEquals(1, $failedCount, 'Second request must fail due to insufficient funds');
        $this->assertEquals('20.00', $wallet->fresh()->balance, 'Wallet must not be overdrawn');
    }

    public function test_22_concurrent_approval_rejection_cancellation_cannot_duplicate_refunds(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '500.00']);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '200.00',
            method: 'bank_transfer',
            destinationDetails: 'Details'
        );

        $this->assertEquals('300.00', $wallet->fresh()->balance);

        $successCount = 0;
        $failedCount = 0;

        // Attempt rejection followed immediately by cancellation on the same record
        try {
            $freshWd = Withdrawal::find($withdrawal->id);
            $this->withdrawalService->reject($freshWd, $admin, 'Reason 1');
            $successCount++;
        } catch (LogicException $e) {
            $failedCount++;
        }

        try {
            $freshWd = Withdrawal::find($withdrawal->id);
            $this->withdrawalService->cancel($freshWd, $client);
            $successCount++;
        } catch (LogicException $e) {
            $failedCount++;
        }

        $this->assertEquals(1, $successCount);
        $this->assertEquals(1, $failedCount);
        $this->assertEquals('500.00', $wallet->fresh()->balance, 'Refund must happen exactly once');
    }

    public function test_23_formatted_money_contains_no_float_conversion(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '12345.67']);

        $withdrawal = $this->withdrawalService->createClientRequest(
            client: $client,
            amount: '1234.50',
            method: 'bank_transfer',
            destinationDetails: 'Details'
        );

        $this->assertEquals('1,234.50', $withdrawal->formatted_amount);
        $this->assertEquals('11,111.17', $wallet->fresh()->formatted_balance);
    }

    public function test_24_http_routes_withdrawal_request_and_cancellation(): void
    {
        $client = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->update(['balance' => '500.00']);

        // 1. Submit withdrawal via HTTP
        $response = $this->actingAs($client)->post(route('client.wallet.withdraw'), [
            'amount' => '150.00',
            'withdrawal_method' => 'bank_transfer',
            'destination_details' => 'Chase Bank 12345678',
            'client_notes' => 'Test notes',
        ]);

        $response->assertRedirect(route('client.wallet'));
        $response->assertSessionHas('success');

        $this->assertEquals('350.00', $wallet->fresh()->balance);
        $withdrawal = Withdrawal::where('user_id', $client->id)->first();
        $this->assertNotNull($withdrawal);
        $this->assertEquals('pending', $withdrawal->status);

        // 2. Cancel withdrawal via HTTP
        $cancelResponse = $this->actingAs($client)->post(route('client.wallet.withdraw.cancel', $withdrawal));
        $cancelResponse->assertRedirect(route('client.wallet'));
        $cancelResponse->assertSessionHas('success');

        $this->assertEquals('500.00', $wallet->fresh()->balance);
        $this->assertEquals('cancelled', $withdrawal->fresh()->status);
    }

    public function test_25_wallet_audit_command_reports_zero_discrepancies_across_all_withdrawal_lifecycle_states(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);

        // 1. Pending withdrawal
        $client1 = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $this->walletService->credit($client1, '1000.00');
        $this->withdrawalService->createClientRequest($client1, '200.00', 'bank_transfer', 'Details 1');

        // 2. Completed withdrawal
        $client2 = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $this->walletService->credit($client2, '1000.00');
        $w2 = $this->withdrawalService->createClientRequest($client2, '300.00', 'bank_transfer', 'Details 2');
        $this->withdrawalService->complete($w2, $admin, 'Wire sent');

        // 3. Rejected withdrawal
        $client3 = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $this->walletService->credit($client3, '1000.00');
        $w3 = $this->withdrawalService->createClientRequest($client3, '400.00', 'bank_transfer', 'Details 3');
        $this->withdrawalService->reject($w3, $admin, 'Invalid account');

        // 4. Cancelled withdrawal
        $client4 = User::factory()->create(['role' => 'client', 'status' => 'active']);
        $this->walletService->credit($client4, '1000.00');
        $w4 = $this->withdrawalService->createClientRequest($client4, '500.00', 'bank_transfer', 'Details 4');
        $this->withdrawalService->cancel($w4, $client4, 'User cancel');

        $this->artisan('wallet:audit')
            ->expectsOutputToContain('All audited wallets are 100% synchronized with the ledger.')
            ->assertExitCode(0);
    }
}

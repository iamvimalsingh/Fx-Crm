<?php

namespace Tests\Feature;

use App\Models\Deposit;
use App\Models\PaymentMethod;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Financial\DepositService;
use App\Services\Financial\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use LogicException;
use Tests\TestCase;

class DepositEngineTest extends TestCase
{
    use RefreshDatabase;

    protected WalletService $walletService;
    protected DepositService $depositService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->walletService = new WalletService();
        $this->depositService = new DepositService($this->walletService);
    }

    public function test_1_client_deposit_request_becomes_pending(): void
    {
        $client = User::factory()->create(['role' => 'client']);

        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '100.00',
            sourceReference: 'REF123',
            clientNotes: 'Initial deposit request'
        );

        $this->assertEquals('pending', $deposit->status);
        $this->assertEquals('100.00', $deposit->amount);
        $this->assertEquals('client_panel', $deposit->request_channel);
        $this->assertEquals('deposit', $deposit->credit_reason);
        $this->assertEquals($client->id, $deposit->user_id);
    }

    public function test_2_wallet_remains_unchanged_while_pending(): void
    {
        $client = User::factory()->create(['role' => 'client']);
        $wallet = $this->walletService->getWallet($client);

        $this->assertEquals('0.00', $wallet->fresh()->balance);

        $this->depositService->createClientRequest(
            client: $client,
            amount: '500.00'
        );

        $this->assertEquals('0.00', $wallet->fresh()->balance);
    }

    public function test_3_client_cannot_specify_another_client_user_id_via_http(): void
    {
        $client1 = User::factory()->create(['role' => 'client']);
        $client2 = User::factory()->create(['role' => 'client']);

        $response = $this->actingAs($client1)->post(route('client.wallet.deposit'), [
            'user_id' => $client2->id,
            'amount' => '250.00',
            'client_notes' => 'Attempting to inject user_id',
        ]);

        $response->assertRedirect(route('client.wallet'));

        $deposit = Deposit::where('amount', '250.00')->first();
        $this->assertNotNull($deposit);
        $this->assertEquals($client1->id, $deposit->user_id);
        $this->assertNotEquals($client2->id, $deposit->user_id);
    }

    public function test_4_admin_can_create_phone_request(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);

        $deposit = $this->depositService->createAdminEntry(
            admin: $admin,
            client: $client,
            amount: '300.00',
            requestChannel: 'phone',
            creditReason: 'deposit',
            adminNotes: 'Phone request from customer care'
        );

        $this->assertEquals('pending', $deposit->status);
        $this->assertEquals('phone', $deposit->request_channel);
        $this->assertEquals($admin->id, $deposit->requested_by_user_id);
    }

    public function test_5_admin_can_create_whatsapp_request(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);

        $deposit = $this->depositService->createAdminEntry(
            admin: $admin,
            client: $client,
            amount: '150.00',
            requestChannel: 'whatsapp',
            creditReason: 'deposit',
            adminNotes: 'WhatsApp confirmation attached'
        );

        $this->assertEquals('pending', $deposit->status);
        $this->assertEquals('whatsapp', $deposit->request_channel);
    }

    public function test_6_admin_can_create_bonus_request(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);

        $deposit = $this->depositService->createAdminEntry(
            admin: $admin,
            client: $client,
            amount: '50.00',
            requestChannel: 'admin',
            creditReason: 'bonus',
            adminNotes: 'Welcome promo bonus'
        );

        $this->assertEquals('pending', $deposit->status);
        $this->assertEquals('bonus', $deposit->credit_reason);
    }

    public function test_7_bonus_records_credit_reason_as_bonus(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);

        $deposit = $this->depositService->createAdminEntry(
            admin: $admin,
            client: $client,
            amount: '100.00',
            requestChannel: 'admin',
            creditReason: 'bonus',
            adminNotes: 'Loyalty bonus'
        );

        $this->assertEquals('bonus', $deposit->credit_reason);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'bonus_created',
            'target_id' => $deposit->id,
        ]);
    }

    public function test_8_approval_credits_wallet_exactly_once(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);
        $wallet = $this->walletService->getWallet($client);

        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '400.00'
        );

        $this->assertEquals('0.00', $wallet->fresh()->balance);

        $approvedDeposit = $this->depositService->approve($deposit, $admin);

        $this->assertEquals('completed', $approvedDeposit->status);
        $this->assertEquals($admin->id, $approvedDeposit->approved_by_user_id);
        $this->assertEquals('400.00', $wallet->fresh()->balance);
    }

    public function test_9_approval_creates_and_links_one_immutable_ledger_transaction(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);

        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '750.00'
        );

        $this->assertNull($deposit->transaction_id);

        $approvedDeposit = $this->depositService->approve($deposit, $admin);

        $this->assertNotNull($approvedDeposit->transaction_id);

        $transaction = Transaction::find($approvedDeposit->transaction_id);
        $this->assertNotNull($transaction);
        $this->assertEquals('750.00', $transaction->amount);
        $this->assertEquals($client->id, $transaction->user_id);
        $this->assertEquals('completed', $transaction->status->value ?? $transaction->status);
    }

    public function test_10_rejection_does_not_modify_wallet(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);
        $wallet = $this->walletService->getWallet($client);

        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '200.00'
        );

        $rejectedDeposit = $this->depositService->reject($deposit, $admin, 'Invalid payment receipt');

        $this->assertEquals('rejected', $rejectedDeposit->status);
        $this->assertNull($rejectedDeposit->transaction_id);
        $this->assertEquals('0.00', $wallet->fresh()->balance);
    }

    public function test_11_rejected_request_cannot_be_approved(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);

        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '100.00'
        );

        $rejectedDeposit = $this->depositService->reject($deposit, $admin, 'Rejected by compliance');

        $this->expectException(LogicException::class);
        $this->depositService->approve($rejectedDeposit, $admin);
    }

    public function test_12_completed_request_cannot_be_approved_again(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);

        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '100.00'
        );

        $completedDeposit = $this->depositService->approve($deposit, $admin);

        $this->expectException(LogicException::class);
        $this->depositService->approve($completedDeposit, $admin);
    }

    public function test_13_concurrent_approval_cannot_double_credit(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);
        $wallet = $this->walletService->getWallet($client);

        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '500.00'
        );

        $this->depositService->approve($deposit, $admin);

        try {
            $this->depositService->approve($deposit, $admin);
            $this->fail('Second approval should have thrown LogicException.');
        } catch (LogicException $e) {
            $this->assertTrue(true);
        }

        $this->assertEquals('500.00', $wallet->fresh()->balance);
        $this->assertEquals(1, Transaction::where('user_id', $client->id)->count());
    }

    public function test_14_invalid_amount_is_rejected(): void
    {
        $client = User::factory()->create(['role' => 'client']);

        $this->expectException(InvalidArgumentException::class);
        $this->depositService->createClientRequest(
            client: $client,
            amount: '0.00'
        );
    }

    public function test_15_invalid_request_channel_or_reason_is_rejected(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);

        $this->expectException(InvalidArgumentException::class);
        $this->depositService->createAdminEntry(
            admin: $admin,
            client: $client,
            amount: '100.00',
            requestChannel: 'invalid_channel',
            creditReason: 'deposit'
        );
    }

    public function test_16_zero_float_money_formatter_and_accessors(): void
    {
        $this->assertEquals('100.00', \App\Services\Financial\MoneyFormatter::format('100'));
        $this->assertEquals('1,234.56', \App\Services\Financial\MoneyFormatter::format('1234.56'));
        $this->assertEquals('0.00', \App\Services\Financial\MoneyFormatter::format(null));
        $this->assertEquals('0.00', \App\Services\Financial\MoneyFormatter::format('0'));
        $this->assertEquals('1,000,000.00', \App\Services\Financial\MoneyFormatter::format('1000000.00'));

        $client = User::factory()->create(['role' => 'client']);
        $wallet = $this->walletService->getWallet($client);
        $wallet->balance = '250.75';
        $wallet->save();

        $this->assertEquals('250.75', $wallet->fresh()->formatted_balance);

        $paymentMethod = PaymentMethod::create([
            'name' => 'Wire Transfer',
            'code' => 'wire',
            'type' => 'bank_transfer',
            'min_amount' => '50.00',
            'max_amount' => '10000.00',
            'is_active' => true,
        ]);

        $this->assertEquals('50.00', $paymentMethod->formatted_min_amount);
        $this->assertEquals('10,000.00', $paymentMethod->formatted_max_amount);

        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '500.00',
            paymentMethodId: $paymentMethod->id
        );

        $this->assertEquals('500.00', $deposit->formatted_amount);
    }

    public function test_17_rejects_inactive_payment_method(): void
    {
        $client = User::factory()->create(['role' => 'client']);

        $inactiveMethod = PaymentMethod::create([
            'name' => 'Disabled Gateway',
            'code' => 'disabled_gw',
            'type' => 'credit_card',
            'is_active' => false,
        ]);

        // Service layer rejection
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('The selected payment method is invalid or inactive.');
        $this->depositService->createClientRequest(
            client: $client,
            amount: '100.00',
            paymentMethodId: $inactiveMethod->id
        );
    }

    public function test_18_http_post_rejects_inactive_payment_method(): void
    {
        $client = User::factory()->create(['role' => 'client']);

        $inactiveMethod = PaymentMethod::create([
            'name' => 'Disabled Crypto',
            'code' => 'crypto_off',
            'type' => 'crypto',
            'is_active' => false,
        ]);

        $response = $this->actingAs($client)->post(route('client.wallet.deposit'), [
            'amount' => '100.00',
            'payment_method_id' => $inactiveMethod->id,
        ]);

        $response->assertSessionHasErrors('payment_method_id');
        $this->assertEquals(0, Deposit::count());
    }

    public function test_19_server_side_min_deposit_limit_enforcement(): void
    {
        $client = User::factory()->create(['role' => 'client']);

        // Default min_deposit is 10.00; attempt 5.00
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Deposit amount must be at least');
        $this->depositService->createClientRequest(
            client: $client,
            amount: '5.00'
        );
    }

    public function test_20_server_side_max_deposit_limit_enforcement(): void
    {
        $client = User::factory()->create(['role' => 'client']);

        // Default max_deposit is 50000.00; attempt 60000.00
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Deposit amount must not exceed');
        $this->depositService->createClientRequest(
            client: $client,
            amount: '60000.00'
        );
    }

    public function test_21_payment_method_specific_min_max_limits_enforced(): void
    {
        $client = User::factory()->create(['role' => 'client']);

        $method = PaymentMethod::create([
            'name' => 'High Roller Wire',
            'code' => 'hr_wire',
            'type' => 'bank_wire',
            'min_amount' => '1000.00',
            'max_amount' => '5000.00',
            'is_active' => true,
        ]);

        // Attempting below payment method min (e.g. 500.00)
        try {
            $this->depositService->createClientRequest(
                client: $client,
                amount: '500.00',
                paymentMethodId: $method->id
            );
            $this->fail('Should reject amount below method min_amount');
        } catch (InvalidArgumentException $e) {
            $this->assertStringContainsString('1000.00', $e->getMessage());
        }

        // Attempting above payment method max (e.g. 6000.00)
        try {
            $this->depositService->createClientRequest(
                client: $client,
                amount: '6000.00',
                paymentMethodId: $method->id
            );
            $this->fail('Should reject amount above method max_amount');
        } catch (InvalidArgumentException $e) {
            $this->assertStringContainsString('5000.00', $e->getMessage());
        }

        // Valid amount within range
        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '2500.00',
            paymentMethodId: $method->id
        );
        $this->assertEquals('2500.00', $deposit->amount);
    }

    public function test_22_http_post_enforces_limits(): void
    {
        $client = User::factory()->create(['role' => 'client']);

        // Post amount below min
        $response = $this->actingAs($client)->post(route('client.wallet.deposit'), [
            'amount' => '2.00',
        ]);
        $response->assertSessionHasErrors('amount');

        // Post amount above max
        $response2 = $this->actingAs($client)->post(route('client.wallet.deposit'), [
            'amount' => '999999.00',
        ]);
        $response2->assertSessionHasErrors('amount');
    }

    public function test_23_admin_entry_rejects_non_client_target_user(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $targetAdmin = User::factory()->create(['role' => 'admin']);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Deposit records can only be created for active client accounts.');
        $this->depositService->createAdminEntry(
            admin: $admin,
            client: $targetAdmin,
            amount: '100.00',
            requestChannel: 'phone',
            creditReason: 'deposit'
        );
    }

    public function test_24_admin_entry_rejects_inactive_client_target_user(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $disabledClient = User::factory()->create([
            'role' => 'client',
            'status' => 'disabled',
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Deposit records can only be created for active client accounts.');
        $this->depositService->createAdminEntry(
            admin: $admin,
            client: $disabledClient,
            amount: '100.00',
            requestChannel: 'phone',
            creditReason: 'deposit'
        );
    }

    public function test_25_robust_concurrency_race_simulation(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $client = User::factory()->create(['role' => 'client']);
        $wallet = $this->walletService->getWallet($client);

        $deposit = $this->depositService->createClientRequest(
            client: $client,
            amount: '1000.00'
        );

        $successCount = 0;
        $failedCount = 0;

        // Simulate two independent approval calls referencing the same deposit ID
        for ($i = 0; $i < 2; $i++) {
            try {
                // Fetch fresh instance to simulate concurrent request worker
                $freshDeposit = Deposit::find($deposit->id);
                $this->depositService->approve($freshDeposit, $admin);
                $successCount++;
            } catch (LogicException $e) {
                $failedCount++;
            }
        }

        $this->assertEquals(1, $successCount, 'Exactly one approval must succeed');
        $this->assertEquals(1, $failedCount, 'Subsequent or concurrent approval must fail');
        $this->assertEquals('1000.00', $wallet->fresh()->balance, 'Wallet must be credited only once');
        $this->assertEquals(1, Transaction::where('user_id', $client->id)->count(), 'Exactly one ledger transaction must be created');
    }
}

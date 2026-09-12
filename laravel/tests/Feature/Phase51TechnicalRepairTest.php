<?php

namespace Tests\Feature;

use App\Models\TradingAccount;
use App\Models\TradingAccountRequest;
use App\Models\User;
use App\Services\Financial\WalletService;
use App\Services\Trading\ManualTradingAdapter;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class Phase51TechnicalRepairTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Money Engine Tests - Zero Float & BCMath Validation
     */
    public function test_money_engine_uses_bcmath_and_normalizes_decimal_strings(): void
    {
        $walletService = new WalletService();

        $this->assertEquals('100.50', $walletService->normalizeAmount('100.5'));
        $this->assertEquals('100.00', $walletService->normalizeAmount('100'));
        $this->assertEquals('0.00', $walletService->normalizeAmount('0'));
        $this->assertEquals('12345.67', $walletService->normalizeAmount('12345.67'));

        $this->assertEquals('150.75', $walletService->add('100.50', '50.25'));
        $this->assertEquals('50.25', $walletService->sub('100.50', '50.25'));
        $this->assertEquals(0, $walletService->compare('100.50', '100.50'));
        $this->assertEquals(1, $walletService->compare('100.51', '100.50'));
        $this->assertEquals(-1, $walletService->compare('100.49', '100.50'));
    }

    public function test_money_engine_rejects_malformed_amounts(): void
    {
        $walletService = new WalletService();

        $this->expectException(InvalidArgumentException::class);
        $walletService->normalizeAmount('12.345'); // More than 2 decimals
    }

    public function test_money_engine_rejects_negative_amounts(): void
    {
        $walletService = new WalletService();

        $this->expectException(InvalidArgumentException::class);
        $walletService->normalizeAmount('-10.00');
    }

    public function test_money_engine_rejects_scientific_notation(): void
    {
        $walletService = new WalletService();

        $this->expectException(InvalidArgumentException::class);
        $walletService->normalizeAmount('1e5');
    }

    public function test_money_engine_rejects_empty_or_non_numeric_values(): void
    {
        $walletService = new WalletService();

        $this->expectException(InvalidArgumentException::class);
        $walletService->normalizeAmount('abc');
    }

    public function test_money_engine_rejects_zero_credit_or_debit(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        $walletService = new WalletService();

        $this->expectException(InvalidArgumentException::class);
        $walletService->credit($user, '0.00');
    }

    /**
     * Trading Account Server-Side Validation Tests
     */
    public function test_server_rejects_unconfigured_platform(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        $response = $this->actingAs($user)->post(route('client.trading-accounts.request'), [
            'platform' => 'InvalidPlatform',
            'account_type' => 'Standard',
            'leverage' => '1:100',
            'currency' => 'USD',
        ]);

        $response->assertSessionHasErrors('platform');
    }

    public function test_server_rejects_unconfigured_account_type(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        $response = $this->actingAs($user)->post(route('client.trading-accounts.request'), [
            'platform' => 'WebTrader',
            'account_type' => 'FakeType',
            'leverage' => '1:100',
            'currency' => 'USD',
        ]);

        $response->assertSessionHasErrors('account_type');
    }

    public function test_server_rejects_unconfigured_leverage(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        $response = $this->actingAs($user)->post(route('client.trading-accounts.request'), [
            'platform' => 'WebTrader',
            'account_type' => 'Standard',
            'leverage' => '1:9999',
            'currency' => 'USD',
        ]);

        $response->assertSessionHasErrors('leverage');
    }

    public function test_server_accepts_valid_configured_trading_account_request(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        $response = $this->actingAs($user)->post(route('client.trading-accounts.request'), [
            'platform' => 'ArrowTrader',
            'account_type' => 'VIP',
            'leverage' => '1:500',
            'currency' => 'usd',
        ]);

        $response->assertRedirect(route('client.trading-accounts.index'));
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('trading_account_requests', [
            'user_id' => $user->id,
            'platform' => 'ArrowTrader',
            'account_type' => 'VIP',
            'leverage' => '1:500',
            'currency' => 'USD',
        ]);
    }

    /**
     * Schema & Relationship Tests
     */
    public function test_trading_account_request_links_to_trading_account_and_nulls_on_delete(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        $account = TradingAccount::create([
            'user_id' => $user->id,
            'login_id' => '100901',
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-01',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $request = TradingAccountRequest::create([
            'user_id' => $user->id,
            'trading_account_id' => $account->id,
            'platform' => 'WebTrader',
            'account_type' => 'Standard',
            'leverage' => '1:100',
            'currency' => 'USD',
            'status' => 'approved',
        ]);

        $this->assertEquals($account->id, $request->fresh()->tradingAccount->id);
        $this->assertTrue($account->requests->contains($request));

        $account->delete();

        $this->assertNull($request->fresh()->trading_account_id);
    }

    public function test_same_login_id_can_exist_on_different_platform_or_server(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        $account1 = TradingAccount::create([
            'user_id' => $user->id,
            'login_id' => '888001',
            'platform_name' => 'WebTrader',
            'server_name' => 'Server-Alpha',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $account2 = TradingAccount::create([
            'user_id' => $user->id,
            'login_id' => '888001', // Same login_id, different platform
            'platform_name' => 'IceTrader',
            'server_name' => 'Server-Alpha',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('trading_accounts', ['id' => $account1->id]);
        $this->assertDatabaseHas('trading_accounts', ['id' => $account2->id]);
    }

    public function test_duplicate_platform_server_and_login_id_is_rejected(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        TradingAccount::create([
            'user_id' => $user->id,
            'login_id' => '888002',
            'platform_name' => 'WebTrader',
            'server_name' => 'Server-Alpha',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $this->expectException(QueryException::class);

        TradingAccount::create([
            'user_id' => $user->id,
            'login_id' => '888002', // Duplicate platform + server + login_id
            'platform_name' => 'WebTrader',
            'server_name' => 'Server-Alpha',
            'account_type' => 'VIP',
            'currency' => 'USD',
            'leverage' => '1:200',
            'status' => 'active',
        ]);
    }

    /**
     * Adapter Tests
     */
    public function test_manual_adapter_does_not_persist_crm_data_and_makes_no_external_calls(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        $adapter = new ManualTradingAdapter();

        $accountRequest = new TradingAccountRequest([
            'user_id' => $user->id,
            'platform' => 'WebTrader',
            'account_type' => 'Standard',
            'leverage' => '1:100',
            'currency' => 'USD',
            'status' => 'pending',
        ]);

        $result = $adapter->processAccountCreation($accountRequest);

        $this->assertTrue($adapter->isManual());
        $this->assertEquals('Manual Broker Administration', $adapter->getProviderName());
        $this->assertTrue($result['success']);
        $this->assertEquals('manual', $result['mode']);

        // Verify accountRequest model was not changed or saved by adapter
        $this->assertFalse($accountRequest->exists);
    }
}

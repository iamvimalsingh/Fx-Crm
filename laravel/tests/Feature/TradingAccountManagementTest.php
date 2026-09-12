<?php

namespace Tests\Feature;

use App\Models\TradingAccount;
use App\Models\TradingAccountRequest;
use App\Models\User;
use App\Services\Trading\ManualTradingAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TradingAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_client_trading_accounts_and_requests(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        $tradingAccount = TradingAccount::create([
            'user_id' => $user->id,
            'login_id' => '100201',
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-01',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $accountRequest = TradingAccountRequest::create([
            'user_id' => $user->id,
            'platform' => 'ArrowTrader',
            'account_type' => 'Raw Spread',
            'leverage' => '1:200',
            'currency' => 'USD',
            'status' => 'pending',
            'notes' => 'Test account request notes',
        ]);

        $response = $this->actingAs($user)->get(route('client.trading-accounts.index'));

        $response->assertOk();
        $response->assertSee('100201');
        $response->assertSee('Arrow Trader');
        $response->assertSee('Test account request notes');
    }

    public function test_it_allows_client_to_submit_trading_account_request(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        $response = $this->actingAs($user)->post(route('client.trading-accounts.request'), [
            'platform' => 'ArrowTrader',
            'account_type' => 'Raw Spread',
            'leverage' => '1:500',
            'currency' => 'USD',
            'notes' => 'High leverage request',
        ]);

        $response->assertRedirect(route('client.trading-accounts.index'));
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('trading_account_requests', [
            'user_id' => $user->id,
            'platform' => 'ArrowTrader',
            'account_type' => 'Raw Spread',
            'leverage' => '1:500',
            'status' => 'pending',
            'notes' => 'High leverage request',
        ]);
    }

    public function test_it_allows_client_to_submit_password_reset_request(): void
    {
        $user = User::factory()->create(['role' => 'client']);

        $tradingAccount = TradingAccount::create([
            'user_id' => $user->id,
            'login_id' => '100202',
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-01',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $response = $this->actingAs($user)->post(route('client.trading-accounts.reset-password', $tradingAccount->id), [
            'notes' => 'Please reset main investor password',
        ]);

        $response->assertRedirect(route('client.trading-accounts.index'));

        $this->assertDatabaseHas('trading_password_reset_requests', [
            'user_id' => $user->id,
            'trading_account_id' => $tradingAccount->id,
            'status' => 'pending',
            'notes' => 'Please reset main investor password',
        ]);
    }

    public function test_it_prevents_unauthorized_user_from_requesting_password_reset_on_others_account(): void
    {
        $owner = User::factory()->create(['role' => 'client']);
        $otherUser = User::factory()->create(['role' => 'client']);

        $tradingAccount = TradingAccount::create([
            'user_id' => $owner->id,
            'login_id' => '100203',
            'platform_name' => 'WebTrader',
            'server_name' => 'Live-01',
            'account_type' => 'Standard',
            'currency' => 'USD',
            'leverage' => '1:100',
            'status' => 'active',
        ]);

        $response = $this->actingAs($otherUser)->post(route('client.trading-accounts.reset-password', $tradingAccount->id), [
            'notes' => 'Unauthorized attempt',
        ]);

        $response->assertStatus(403);
    }

    public function test_manual_trading_adapter_records_manual_operations(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        $adapter = new ManualTradingAdapter();

        $accountRequest = TradingAccountRequest::create([
            'user_id' => $user->id,
            'platform' => 'WebTrader',
            'account_type' => 'Standard',
            'leverage' => '1:100',
            'currency' => 'USD',
            'status' => 'pending',
        ]);

        $result = $adapter->processAccountCreation($accountRequest);

        $this->assertTrue($result['success']);
        $this->assertEquals('manual', $result['mode']);
        $this->assertTrue($adapter->isManual());
    }
}

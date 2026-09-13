<?php

namespace Database\Seeders;

use App\Models\PaymentMethod;
use App\Models\Setting;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Default Payment Methods
        if (PaymentMethod::count() === 0) {
            PaymentMethod::create([
                'name' => 'USDT (TRC20)',
                'description' => 'Fast deposit with Tether TRC20 network.',
                'instructions' => 'Send USDT (TRC20) to the designated company wallet address and enter transaction hash.',
                'min_amount' => 10.00,
                'max_amount' => 50000.00,
                'is_active' => true,
                'sort_order' => 1,
            ]);

            PaymentMethod::create([
                'name' => 'Bank Wire Transfer',
                'description' => 'Direct international wire transfer.',
                'instructions' => 'Transfer to our official corporate bank account and upload the payment receipt.',
                'min_amount' => 100.00,
                'max_amount' => 50000.00,
                'is_active' => true,
                'sort_order' => 2,
            ]);

            PaymentMethod::create([
                'name' => 'Bitcoin (BTC)',
                'description' => 'Direct Bitcoin network transfer.',
                'instructions' => 'Send BTC to the company Bitcoin address and enter transaction ID.',
                'min_amount' => 50.00,
                'max_amount' => 50000.00,
                'is_active' => true,
                'sort_order' => 3,
            ]);
        }

        // Default White-Label & System Settings
        if (Setting::where('key', 'COMPANY_NAME')->doesntExist()) {
            Setting::set('COMPANY_NAME', 'Forex Broker CRM');
        }

        if (Setting::where('key', 'SUPPORT_EMAIL')->doesntExist()) {
            Setting::set('SUPPORT_EMAIL', 'support@example.com');
        }
    }
}

<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'crm:create-admin 
                            {email? : Administrator email address}
                            {--password= : Optional plaintext password}
                            {--first_name=Administrator : Administrator first name}
                            {--last_name=User : Administrator last name}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Provision or promote a system administrator account for the CRM Operations Terminal';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = $this->argument('email');
        if (! $email) {
            $email = $this->ask('Administrator Email Address');
        }

        $password = $this->option('password');
        if (! $password) {
            $password = $this->secret('Administrator Password (minimum 8 characters)');
        }

        $firstName = $this->option('first_name') ?: 'Administrator';
        $lastName = $this->option('last_name') ?: 'User';

        $validator = Validator::make([
            'email' => $email,
            'password' => $password,
        ], [
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $existingUser = User::where('email', $email)->first();

        if ($existingUser) {
            $this->warn("User [{$email}] already exists in the system.");
            if ($this->confirm("Would you like to promote this user to Administrator and update their password?", true)) {
                $existingUser->update([
                    'role' => UserRole::ADMIN,
                    'status' => UserStatus::ACTIVE,
                    'password' => Hash::make($password),
                    'email_verified_at' => $existingUser->email_verified_at ?: now(),
                ]);

                UserProfile::firstOrCreate(
                    ['user_id' => $existingUser->id],
                    [
                        'first_name' => $firstName,
                        'last_name' => $lastName,
                        'country' => 'US',
                    ]
                );

                $this->info("User [{$email}] has been successfully elevated to Administrator.");

                return self::SUCCESS;
            }

            $this->comment('Operation aborted. No changes made.');

            return self::FAILURE;
        }

        $admin = User::create([
            'email' => $email,
            'password' => Hash::make($password),
            'role' => UserRole::ADMIN,
            'status' => UserStatus::ACTIVE,
            'email_verified_at' => now(),
        ]);

        UserProfile::create([
            'user_id' => $admin->id,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'country' => 'US',
        ]);

        $this->info("Administrator [{$email}] successfully created.");

        return self::SUCCESS;
    }
}

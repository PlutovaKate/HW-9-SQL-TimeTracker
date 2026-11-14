<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;

use App\Enums\Role;
use DateTimeInterface;

class User extends Model
{
    protected $fillable = [
        'full_name',
        'email',
        'password',
        'work_start',
        'daily_hours',
        'vacation_days',
    ];

    protected $casts = [
        'role' => Role::class,
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'token_expired_at' => 'datetime',
    ];


    protected $hidden = [
        'password',
        'api_token',
        'token_expired_at',
        'updated_at',
    ];

    protected $appends = [
        'role_label',
        'phone',
    ];

    protected function roleLabel(): Attribute
    {
        return Attribute::make(
            get: fn() => match ($this->role) {
                Role::ADMIN => 'Адміністратор',
                Role::EMPLOYEE => 'Працівник',
            }
        );
    }

    protected function phone(): Attribute
    {
        return Attribute::make(
            get: fn() => null
        );
    }

    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->format('Y-m-d\TH:i:s\Z');
    }



    public function timeEntries()
    {
        return $this->hasMany(TimeEntry::class, 'user_id');
    }


    public function leaveRequests()
    {
        return $this->hasMany(LeaveRequest::class, 'user_id');
    }

    public function leaveRequestReviews()
    {
        return $this->hasMany(LeaveRequest::class, 'reviewed_by');
    }
}

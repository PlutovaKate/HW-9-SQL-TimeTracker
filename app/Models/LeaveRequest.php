<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaveRequest extends Model
{

    protected $table = 'leave_requests';
    const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'type',
        'date_from',
        'date_to',
        'status',
        'comment',
        'reviewed_by',
        'reviewed_at',

    ];

    protected $casts = [
        'date_from' => 'date',
        'date_to' => 'date',
        'reviewed_at' => 'datetime',
        'created_at' => 'datetime',
    ];


    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}

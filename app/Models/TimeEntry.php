<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TimeEntry extends Model
{

    protected $table = 'time_entries';
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'type',
        'started_at',
        'c',
        'note',
        'created_by',

    ];

    protected $casts = [

        'started_at' => 'datetime',
        'ended_at' => 'datetime',

    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }


    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

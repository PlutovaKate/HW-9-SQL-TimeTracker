<?php

namespace App\Models;

use App\Enums\TimeEntryType;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimeEntry extends Model
{
    // Таблица записей рабочего времени. / Work time entries table.
    protected $table = 'time_entries';

    // Поля, разрешённые для массового заполнения. / Mass-assignable attributes.
    protected $fillable = [
        'user_id',
        'type',
        'started_at',
        'ended_at',
        'note',
        'created_by',
    ];

    // В таблице отсутствуют created_at и updated_at. / The table has no created_at or updated_at columns.
    public $timestamps = false;

    // Поля, доступные в ответах API. / Attributes exposed in API responses.
    protected $visible = [
        'id',
        'user_id',
        'type',
        'started_at',
        'ended_at',
        'note',
        'is_manual',
    ];

    // Добавляем вычисляемое поле is_manual в JSON. / Append the computed is_manual attribute to JSON.
    protected $appends = ['is_manual'];

    // Преобразование полей в соответствующие типы. / Cast attributes to their respective types.
    protected $casts = [
        'type' => TimeEntryType::class,
        'user_id' => 'integer',
        'created_by' => 'integer',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    /**
     * Определить, была ли запись создана или изменена другим пользователем.
     * / Determine whether the entry was created or modified by another user.
     *
     * Для собственных записей created_by равен user_id.
     * / For self-created entries, created_by equals user_id.
     */
    public function getIsManualAttribute(): bool
    {
        return $this->created_by !== $this->user_id;
    }

    /**
     * Сериализовать дату в формате ISO 8601 с обозначением UTC.
     * / Serialize a date in ISO 8601 format with a UTC indicator.
     */
    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->format('Y-m-d\\TH:i:s\\Z');
    }

    /**
     * Получить пользователя, которому принадлежит запись.
     * / Get the user who owns this entry.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Получить пользователя, создавшего или изменившего запись.
     * / Get the user who created or last edited this entry.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Завершить интервал, установив текущее время окончания.
     * / Close the interval by setting the current end time.
     */
    public function closeEntry(): void
    {
        $this->update([
            'ended_at' => date('Y-m-d H:i:s'),
        ]);
    }
}

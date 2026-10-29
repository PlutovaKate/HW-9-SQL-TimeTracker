<?php

namespace App\Controllers;

class HealthController
{
    public function check(): void
    {
        response(['status' => 'OK']);
    }

    // public function show(string $id): void
    // {
    //     response(['id' => $id]);
    // }
}

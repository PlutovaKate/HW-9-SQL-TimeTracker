<?php

namespace App\Controllers;

class HealthController
{

    public function check(): void
    {
        response(['status' => 'OK']);
    }
}

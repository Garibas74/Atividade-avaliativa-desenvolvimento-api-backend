<?php
if (!is_dir(__DIR__ . '/data')) mkdir(__DIR__ . '/data', 0755, true);
if (!file_exists(__DIR__ . '/data/logs.db')) touch(__DIR__ . '/data/logs.db');
require __DIR__ . '/bootstrap.php';
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;
if (!Capsule::schema()->hasTable('logs')) {
    Capsule::schema()->create('logs', function (Blueprint $table) {
        $table->uuid('id')->primary();
        $table->string('acao', 40);
        $table->text('detalhe');
        $table->unsignedBigInteger('usuarioId')->nullable()->index();
        $table->timestamp('timestamp');
    });
}

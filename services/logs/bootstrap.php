<?php
require __DIR__ . '/vendor/autoload.php';
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
date_default_timezone_set('UTC');
$capsule = new Capsule;
$capsule->addConnection(['driver' => 'sqlite', 'database' => __DIR__ . '/data/logs.db', 'prefix' => '']);
$capsule->setAsGlobal();
$capsule->bootEloquent();
class AuditLog extends Model {
    protected $table = 'logs';
    public $timestamps = false;
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'acao', 'detalhe', 'usuarioId', 'timestamp'];
    protected $casts = ['usuarioId' => 'integer'];
}

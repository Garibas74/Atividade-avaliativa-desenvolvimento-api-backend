<?php
require __DIR__ . '/bootstrap.php';
echo AuditLog::orderByDesc('timestamp')->limit(50)->get()->toJson(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;

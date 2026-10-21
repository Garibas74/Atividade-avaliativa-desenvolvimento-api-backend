<?php
require __DIR__ . '/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
function respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}
$secret = getenv('SERVICE_TOKEN');
if (!$secret || strlen($secret) < 32) respond(500, ['erro' => 'Configuração inválida']);
if (!hash_equals($secret, $_SERVER['HTTP_X_SERVICE_TOKEN'] ?? '')) respond(401, ['erro' => 'Serviço não autorizado']);
if (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) !== '/api/logs' || $_SERVER['REQUEST_METHOD'] !== 'POST') respond(404, ['erro' => 'Rota não encontrada']);
try {
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if (strlen($raw) > 16384) respond(413, ['erro' => 'Evento muito grande']);
    $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($data) || !is_string($data['id'] ?? null) || !preg_match('/^[0-9a-f-]{36}$/i', $data['id']) ||
        !in_array($data['acao'] ?? null, ['CRIACAO', 'CONCLUSAO', 'ALTERACAO', 'EXCLUSAO', 'ACESSO_INDEVIDO', 'ERRO'], true) ||
        !is_string($data['detalhe'] ?? null) || strlen($data['detalhe']) > 4000 ||
        !is_string($data['timestamp'] ?? null) || strtotime($data['timestamp']) === false ||
        (isset($data['usuarioId']) && (!is_int($data['usuarioId']) || $data['usuarioId'] <= 0))) respond(400, ['erro' => 'Evento inválido']);
    $log = AuditLog::firstOrCreate(['id' => $data['id']], [
        'acao' => $data['acao'], 'detalhe' => $data['detalhe'], 'usuarioId' => $data['usuarioId'] ?? null,
        'timestamp' => gmdate('Y-m-d H:i:s', strtotime($data['timestamp']))
    ]);
    respond($log->wasRecentlyCreated ? 201 : 200, ['id' => $log->id]);
} catch (JsonException $e) {
    respond(400, ['erro' => 'JSON inválido']);
} catch (Throwable $e) {
    error_log('Falha ao persistir evento: ' . get_class($e));
    respond(500, ['erro' => 'Falha ao persistir evento']);
}

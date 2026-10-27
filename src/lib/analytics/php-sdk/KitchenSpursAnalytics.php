<?php

namespace KitchenSpurs\Analytics;

/**
 * Kitchen Spurs PHP & Laravel Server Tracking Client
 *
 * Lightweight, resilient HTTP client for sending transactional business events
 * from Laravel controllers, jobs, and event listeners.
 *
 * Example Usage in Laravel:
 *
 *   use KitchenSpurs\Analytics\KitchenSpursAnalytics;
 *
 *   $tracker = new KitchenSpursAnalytics([
 *       'endpoint' => config('services.kitchen_spurs.endpoint', 'http://localhost:3000/api/v1/events'),
 *       'api_key'  => config('services.kitchen_spurs.api_key', 'sk_ks_live_default'),
 *   ]);
 *
 *   // Track Order Creation
 *   $tracker->track([
 *       'event'          => 'order_created',
 *       'user_id'        => $order->user_id,
 *       'anonymous_id'   => request()->cookie('_ksa_anon_id') ?? 'anon_guest',
 *       'session_id'     => request()->cookie('_ksa_session_id') ?? 'sess_server',
 *       'idempotency_key'=> 'ord_' . $order->id,
 *       'properties'     => [
 *           'order_id'       => $order->id,
 *           'total'          => $order->total_amount,
 *           'currency'       => 'USD',
 *           'items_count'    => $order->items->count(),
 *           'payment_method' => $order->payment_method,
 *       ],
 *   ]);
 */
class KitchenSpursAnalytics
{
    protected string $endpoint;
    protected string $apiKey;
    protected int $timeout;
    protected bool $debug;

    public function __construct(array $config = [])
    {
        $this->endpoint = $config['endpoint'] ?? 'http://localhost:3000/api/v1/events';
        $this->apiKey   = $config['api_key'] ?? 'sk_ks_live_default';
        $this->timeout  = $config['timeout'] ?? 3; // 3 seconds max timeout
        $this->debug    = $config['debug'] ?? false;
    }

    /**
     * Dispatch a server event (e.g. order_created, refund_issued, reservation_confirmed)
     */
    public function track(array $params): bool
    {
        $payload = [
            'eventId'      => $params['idempotency_key'] ?? $this->uuid(),
            'eventName'    => $params['event'] ?? 'server_event',
            'source'       => 'server',
            'anonymousId'  => $params['anonymous_id'] ?? ('anon_srv_' . substr(md5(uniqid()), 0, 8)),
            'userId'       => $params['user_id'] ?? null,
            'sessionId'    => $params['session_id'] ?? ('sess_srv_' . substr(md5(uniqid()), 0, 8)),
            'timestamp'    => (int) (microtime(true) * 1000),
            'properties'   => $params['properties'] ?? [],
            'context'      => array_merge([
                'serverEnvironment' => getenv('APP_ENV') ?: 'production',
                'platform'          => 'PHP ' . PHP_VERSION,
                'library'           => [
                    'name'    => 'kitchen-spurs-php-sdk',
                    'version' => '1.0.0',
                ],
            ], $params['context'] ?? []),
        ];

        return $this->send([$payload]);
    }

    /**
     * Identify a user with traits
     */
    public function identify(string $userId, array $traits = [], ?string $anonymousId = null): bool
    {
        $payload = [
            'eventId'     => 'srv_id_' . $this->uuid(),
            'eventName'   => 'identify',
            'source'      => 'server',
            'anonymousId' => $anonymousId ?? ('anon_srv_' . substr(md5(uniqid()), 0, 8)),
            'userId'      => $userId,
            'sessionId'   => 'sess_srv_' . substr(md5(uniqid()), 0, 8),
            'timestamp'   => (int) (microtime(true) * 1000),
            'properties'  => $traits,
            'context'     => [
                'serverEnvironment' => getenv('APP_ENV') ?: 'production',
                'platform'          => 'PHP ' . PHP_VERSION,
            ],
        ];

        return $this->send([$payload]);
    }

    /**
     * Internal cURL sender with non-blocking resilience
     */
    protected function send(array $events): bool
    {
        $data = json_encode(['events' => $events]);

        $ch = curl_init($this->endpoint);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Length: ' . strlen($data),
        ]);

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($this->debug && ($error || $httpCode >= 400)) {
            error_log("[KitchenSpursAnalytics PHP] HTTP {$httpCode}: {$error} - Response: {$result}");
        }

        return ($httpCode >= 200 && $httpCode < 300);
    }

    protected function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}

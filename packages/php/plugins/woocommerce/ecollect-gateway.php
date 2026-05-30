<?php

/**
 * Plugin Name: ecollect Payment Gateway
 * Plugin URI:  https://www.e-collect.com
 * Description: Accept payments via ecollect LatAm payment gateway in WooCommerce.
 * Version:     1.0.0
 * Author:      ecollect
 * Author URI:  https://www.e-collect.com
 * License:     MIT
 * Text Domain: ecollect-woocommerce
 * Requires at least: 5.0
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.0
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register the ecollect gateway with WooCommerce.
 */
add_filter('woocommerce_payment_gateways', function (array $gateways): array {
    $gateways[] = 'WC_Ecollect_Gateway';
    return $gateways;
});

/**
 * Initialize the gateway class after all plugins are loaded.
 */
add_action('plugins_loaded', function (): void {
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    }

    /**
     * WooCommerce ecollect Payment Gateway.
     */
    class WC_Ecollect_Gateway extends WC_Payment_Gateway
    {
        public function __construct()
        {
            $this->id                 = 'ecollect';
            $this->icon               = '';
            $this->has_fields         = false;
            $this->method_title       = __('ecollect', 'ecollect-woocommerce');
            $this->method_description = __('Accept payments via ecollect LatAm payment gateway.', 'ecollect-woocommerce');

            $this->supports = ['products'];

            $this->init_form_fields();
            $this->init_settings();

            $this->title       = $this->get_option('title');
            $this->description = $this->get_option('description');
            $this->enabled     = $this->get_option('enabled');

            add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
            add_action('woocommerce_api_ecollect_webhook', [$this, 'webhook']);
        }

        /**
         * Initialize gateway form fields (admin settings).
         */
        public function init_form_fields(): void
        {
            $this->form_fields = [
                'enabled' => [
                    'title'   => __('Enable/Disable', 'ecollect-woocommerce'),
                    'type'    => 'checkbox',
                    'label'   => __('Enable ecollect Payment Gateway', 'ecollect-woocommerce'),
                    'default' => 'yes',
                ],
                'title' => [
                    'title'       => __('Title', 'ecollect-woocommerce'),
                    'type'        => 'text',
                    'description' => __('Payment method title shown to customers during checkout.', 'ecollect-woocommerce'),
                    'default'     => __('ecollect', 'ecollect-woocommerce'),
                    'desc_tip'    => true,
                ],
                'description' => [
                    'title'       => __('Description', 'ecollect-woocommerce'),
                    'type'        => 'textarea',
                    'description' => __('Payment method description shown to customers during checkout.', 'ecollect-woocommerce'),
                    'default'     => __('Pay securely via ecollect.', 'ecollect-woocommerce'),
                ],
                'api_key' => [
                    'title'       => __('API Key', 'ecollect-woocommerce'),
                    'type'        => 'password',
                    'description' => __('Your ecollect private API key. Keep this secret.', 'ecollect-woocommerce'),
                    'default'     => '',
                    'desc_tip'    => true,
                ],
                'ety_code' => [
                    'title'       => __('Entity Code (ETY)', 'ecollect-woocommerce'),
                    'type'        => 'text',
                    'description' => __('Your ecollect merchant entity code.', 'ecollect-woocommerce'),
                    'default'     => '',
                    'desc_tip'    => true,
                ],
                'srv_code' => [
                    'title'       => __('Service Code (SRV)', 'ecollect-woocommerce'),
                    'type'        => 'text',
                    'description' => __('Your ecollect service code for this payment concept.', 'ecollect-woocommerce'),
                    'default'     => '',
                    'desc_tip'    => true,
                ],
                'environment' => [
                    'title'       => __('Environment', 'ecollect-woocommerce'),
                    'type'        => 'select',
                    'description' => __('Select Test for sandbox testing, Production for live payments.', 'ecollect-woocommerce'),
                    'default'     => 'test',
                    'options'     => [
                        'test' => __('Test (Sandbox)', 'ecollect-woocommerce'),
                        'prod' => __('Production', 'ecollect-woocommerce'),
                    ],
                ],
            ];
        }

        /**
         * Process the payment for an order.
         *
         * @param  int   $order_id
         * @return array{result: string, redirect: string}|void
         */
        public function process_payment($order_id)
        {
            $order = wc_get_order($order_id);

            if (!$order) {
                wc_add_notice(__('Order not found.', 'ecollect-woocommerce'), 'error');
                return;
            }

            $apiKey      = $this->get_option('api_key');
            $etyCode     = (int)$this->get_option('ety_code');
            $srvCode     = (int)$this->get_option('srv_code');
            $environment = $this->get_option('environment', 'test');

            if (empty($apiKey) || $etyCode <= 0) {
                wc_add_notice(__('ecollect is not configured correctly. Please contact the store owner.', 'ecollect-woocommerce'), 'error');
                return;
            }

            try {
                // Load the Ecollect SDK (assumes Composer autoload is available)
                if (!class_exists('\\Ecollect\\EcollectClient')) {
                    require_once plugin_dir_path(__FILE__) . '../../vendor/autoload.php';
                }

                $client = new \Ecollect\EcollectClient([
                    'api_key'     => $apiKey,
                    'ety_code'    => $etyCode,
                    'srv_code'    => $srvCode,
                    'environment' => $environment,
                ]);

                $customer = new \Ecollect\Types\Customer([
                    'email'     => $order->get_billing_email(),
                    'full_name' => $order->get_formatted_billing_full_name(),
                    'phone'     => $order->get_billing_phone(),
                ]);

                $webhookUrl  = home_url('/wc-api/ecollect_webhook');
                $redirectUrl = $this->get_return_url($order);

                $intent = new \Ecollect\Types\PaymentIntent([
                    'amount'                 => (float)$order->get_total(),
                    'currency'               => get_woocommerce_currency(),
                    'customer'               => $customer,
                    'srv_code'               => $srvCode,
                    'merchant_transaction_id' => (string)$order->get_order_number(),
                    'redirect_url'           => $redirectUrl,
                    'response_url'           => $webhookUrl,
                ]);

                $result = $client->payments->hostedCheckout($intent);

                // Mark order as pending
                $order->update_status('pending', __('Awaiting ecollect payment.', 'ecollect-woocommerce'));
                WC()->cart->empty_cart();

                // Redirect to ecollect payment page
                $redirectTo = $result['eCollectUrl'] ?? $redirectUrl;

                return [
                    'result'   => 'success',
                    'redirect' => $redirectTo,
                ];
            } catch (\Ecollect\Exceptions\EcollectException $e) {
                wc_add_notice(
                    __('Payment error: ', 'ecollect-woocommerce') . $e->getMessage(),
                    'error'
                );
                return;
            } catch (\Exception $e) {
                wc_add_notice(
                    __('An unexpected error occurred. Please try again.', 'ecollect-woocommerce'),
                    'error'
                );
                return;
            }
        }

        /**
         * Handle URLResponse webhook callbacks from ecollect.
         */
        public function webhook(): void
        {
            $rawBody = file_get_contents('php://input');
            $payload = json_decode($rawBody, true);

            if (empty($payload)) {
                status_header(400);
                echo json_encode(['ReturnCode' => 'FAIL_SYSTEM']);
                exit;
            }

            $ticketId = $payload['TicketId'] ?? null;
            $tranState = $payload['TranState'] ?? null;

            if (!$ticketId) {
                status_header(400);
                echo json_encode(['ReturnCode' => 'FAIL_SYSTEM']);
                exit;
            }

            // Find order by ticket id stored in order meta
            $orders = wc_get_orders([
                'meta_key'   => '_ecollect_ticket_id',
                'meta_value' => $ticketId,
                'limit'      => 1,
            ]);

            if (empty($orders)) {
                // Try to find by merchant transaction id in references
                $referenceArray = $payload['ReferenceArray'] ?? [];
                $merchantId = $referenceArray[2] ?? null;

                if ($merchantId) {
                    $order = wc_get_order((int)$merchantId);
                } else {
                    echo json_encode(['ReturnCode' => 'SUCCESS']);
                    exit;
                }
            } else {
                $order = $orders[0];
            }

            if (!$order) {
                echo json_encode(['ReturnCode' => 'SUCCESS']);
                exit;
            }

            switch ($tranState) {
                case 'OK':
                    $order->payment_complete((string)$ticketId);
                    $order->add_order_note(
                        sprintf(__('ecollect payment approved. TicketId: %s', 'ecollect-woocommerce'), $ticketId)
                    );
                    break;

                case 'NOT_AUTHORIZED':
                case 'FAILED':
                    $order->update_status(
                        'failed',
                        sprintf(__('ecollect payment %s. TicketId: %s', 'ecollect-woocommerce'), $tranState, $ticketId)
                    );
                    break;

                case 'PENDING':
                case 'BANK':
                    $order->update_status(
                        'on-hold',
                        sprintf(__('ecollect payment pending. TicketId: %s', 'ecollect-woocommerce'), $ticketId)
                    );
                    break;
            }

            echo json_encode(['ReturnCode' => 'SUCCESS']);
            exit;
        }
    }
});

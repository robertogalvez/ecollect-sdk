<?php

/**
 * ecollect Payment Module for PrestaShop
 *
 * @author    ecollect
 * @copyright 2024 ecollect
 * @license   MIT
 */

declare(strict_types=1);

if (!defined('_PS_VERSION_')) {
    exit;
}

/**
 * ecollect PrestaShop Payment Module.
 *
 * Integrates the ecollect LatAm payment gateway with PrestaShop.
 */
class Ecollect extends PaymentModule
{
    public function __construct()
    {
        $this->name          = 'ecollect';
        $this->tab           = 'payments_gateways';
        $this->version       = '1.0.0';
        $this->author        = 'ecollect';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = [
            'min' => '1.7.0.0',
            'max' => _PS_VERSION_,
        ];
        $this->bootstrap     = true;

        parent::__construct();

        $this->displayName = $this->l('ecollect Payment Gateway');
        $this->description = $this->l('Accept payments via ecollect LatAm payment gateway.');

        $this->confirmUninstall = $this->l('Are you sure you want to uninstall ecollect?');
    }

    /**
     * Install the module and register hooks.
     */
    public function install(): bool
    {
        return parent::install()
            && $this->registerHook('paymentOptions')
            && $this->registerHook('paymentReturn')
            && $this->registerHook('actionFrontControllerSetMedia');
    }

    /**
     * Uninstall the module and clean up configuration.
     */
    public function uninstall(): bool
    {
        Configuration::deleteByName('ECOLLECT_API_KEY');
        Configuration::deleteByName('ECOLLECT_ETY_CODE');
        Configuration::deleteByName('ECOLLECT_SRV_CODE');
        Configuration::deleteByName('ECOLLECT_ENVIRONMENT');

        return parent::uninstall();
    }

    /**
     * Module configuration page (back-office).
     */
    public function getContent(): string
    {
        $output = '';

        if (Tools::isSubmit('submit_ecollect')) {
            $apiKey      = Tools::getValue('ECOLLECT_API_KEY');
            $etyCode     = (int)Tools::getValue('ECOLLECT_ETY_CODE');
            $srvCode     = (int)Tools::getValue('ECOLLECT_SRV_CODE');
            $environment = Tools::getValue('ECOLLECT_ENVIRONMENT');

            if (empty($apiKey) || $etyCode <= 0) {
                $output .= $this->displayError($this->l('API Key and Entity Code are required.'));
            } else {
                Configuration::updateValue('ECOLLECT_API_KEY', $apiKey);
                Configuration::updateValue('ECOLLECT_ETY_CODE', $etyCode);
                Configuration::updateValue('ECOLLECT_SRV_CODE', $srvCode);
                Configuration::updateValue('ECOLLECT_ENVIRONMENT', $environment);
                $output .= $this->displayConfirmation($this->l('Settings saved successfully.'));
            }
        }

        return $output . $this->displayForm();
    }

    /**
     * Build the configuration form.
     */
    private function displayForm(): string
    {
        $helper              = new HelperForm();
        $helper->module      = $this;
        $helper->name_controller = $this->name;
        $helper->token       = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex = AdminController::$currentIndex . '&configure=' . $this->name;
        $helper->default_form_language    = (int)Configuration::get('PS_LANG_DEFAULT');
        $helper->allow_employee_form_lang = (int)Configuration::get('PS_BO_ALLOW_EMPLOYEE_FORM_LANG');
        $helper->title                    = $this->displayName;
        $helper->submit_action            = 'submit_ecollect';

        $fieldsForm = [
            'form' => [
                'legend' => [
                    'title' => $this->l('Settings'),
                    'icon'  => 'icon-cogs',
                ],
                'input' => [
                    [
                        'type'     => 'password',
                        'label'    => $this->l('API Key'),
                        'name'     => 'ECOLLECT_API_KEY',
                        'required' => true,
                        'desc'     => $this->l('Your ecollect private API key.'),
                    ],
                    [
                        'type'     => 'text',
                        'label'    => $this->l('Entity Code (ETY)'),
                        'name'     => 'ECOLLECT_ETY_CODE',
                        'required' => true,
                        'desc'     => $this->l('Your ecollect merchant entity code.'),
                    ],
                    [
                        'type'  => 'text',
                        'label' => $this->l('Service Code (SRV)'),
                        'name'  => 'ECOLLECT_SRV_CODE',
                        'desc'  => $this->l('Your ecollect service code.'),
                    ],
                    [
                        'type'  => 'select',
                        'label' => $this->l('Environment'),
                        'name'  => 'ECOLLECT_ENVIRONMENT',
                        'options' => [
                            'query' => [
                                ['id' => 'test', 'name' => $this->l('Test (Sandbox)')],
                                ['id' => 'prod', 'name' => $this->l('Production')],
                            ],
                            'id'   => 'id',
                            'name' => 'name',
                        ],
                    ],
                ],
                'submit' => [
                    'title' => $this->l('Save'),
                ],
            ],
        ];

        $helper->fields_value = [
            'ECOLLECT_API_KEY'     => Configuration::get('ECOLLECT_API_KEY'),
            'ECOLLECT_ETY_CODE'    => Configuration::get('ECOLLECT_ETY_CODE'),
            'ECOLLECT_SRV_CODE'    => Configuration::get('ECOLLECT_SRV_CODE'),
            'ECOLLECT_ENVIRONMENT' => Configuration::get('ECOLLECT_ENVIRONMENT', 'test'),
        ];

        return $helper->generateForm([$fieldsForm]);
    }

    /**
     * hookPaymentOptions: return payment options for checkout.
     *
     * @param  array<string, mixed> $params
     * @return PrestaShop\PrestaShop\Core\Payment\PaymentOption[]
     */
    public function hookPaymentOptions(array $params): array
    {
        if (!$this->active) {
            return [];
        }

        $newOption = new PrestaShop\PrestaShop\Core\Payment\PaymentOption();
        $newOption->setModuleName($this->name)
            ->setCallToActionText($this->l('Pay with ecollect'))
            ->setAction($this->context->link->getModuleLink($this->name, 'payment', [], true))
            ->setAdditionalInformation(
                $this->fetch('module:' . $this->name . '/views/templates/hook/payment_info.tpl')
            );

        return [$newOption];
    }

    /**
     * hookPaymentReturn: display confirmation after payment.
     *
     * @param  array<string, mixed> $params
     * @return string
     */
    public function hookPaymentReturn(array $params): string
    {
        if (!$this->active) {
            return '';
        }

        $order = $params['order'] ?? null;
        if (!$order) {
            return '';
        }

        $this->smarty->assign([
            'order_reference' => $order->reference,
            'status'          => $order->getCurrentState() === (int)Configuration::get('PS_OS_PAYMENT')
                ? 'ok' : 'failed',
        ]);

        return $this->fetch('module:' . $this->name . '/views/templates/hook/payment_return.tpl');
    }

    /**
     * hookActionFrontControllerSetMedia: load front-end assets.
     */
    public function hookActionFrontControllerSetMedia(): void
    {
        if ($this->context->controller->php_self === 'order') {
            // Load any front-end styles/scripts if needed
            // $this->context->controller->registerStylesheet('module-ecollect-style', 'modules/' . $this->name . '/views/css/front.css');
        }
    }

    /**
     * Build a PaymentIntent and redirect to ecollect hosted checkout.
     *
     * Called from the payment controller (controllers/front/payment.php).
     *
     * @param  Cart $cart
     * @return string|null eCollectUrl or null on failure
     */
    public function initiatePayment(Cart $cart): ?string
    {
        $apiKey      = Configuration::get('ECOLLECT_API_KEY');
        $etyCode     = (int)Configuration::get('ECOLLECT_ETY_CODE');
        $srvCode     = (int)Configuration::get('ECOLLECT_SRV_CODE');
        $environment = Configuration::get('ECOLLECT_ENVIRONMENT', 'test');

        if (empty($apiKey) || $etyCode <= 0) {
            return null;
        }

        // Load Ecollect SDK
        $autoload = dirname(__FILE__) . '/../../../vendor/autoload.php';
        if (!class_exists('\\Ecollect\\EcollectClient') && file_exists($autoload)) {
            require_once $autoload;
        }

        $client = new \Ecollect\EcollectClient([
            'api_key'     => $apiKey,
            'ety_code'    => $etyCode,
            'srv_code'    => $srvCode,
            'environment' => $environment,
        ]);

        $customer = new \Ecollect\Types\Customer([
            'email'     => $this->context->customer->email,
            'full_name' => $this->context->customer->firstname . ' ' . $this->context->customer->lastname,
        ]);

        $currency = new Currency($cart->id_currency);

        $redirectUrl = $this->context->link->getModuleLink($this->name, 'confirmation', [], true);
        $webhookUrl  = $this->context->link->getModuleLink($this->name, 'webhook', [], true);

        $intent = new \Ecollect\Types\PaymentIntent([
            'amount'                 => (float)$cart->getOrderTotal(),
            'currency'               => $currency->iso_code,
            'customer'               => $customer,
            'srv_code'               => $srvCode,
            'merchant_transaction_id' => (string)$cart->id,
            'redirect_url'           => $redirectUrl,
            'response_url'           => $webhookUrl,
        ]);

        $result = $client->payments->hostedCheckout($intent);

        return $result['eCollectUrl'] ?? null;
    }
}

=== ecollect Payment Gateway ===
Contributors: ecollect
Tags: payment, gateway, ecollect, latam, colombia, mexico, dominican republic, woocommerce
Requires at least: 5.0
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: MIT

Accept payments via ecollect LatAm payment gateway in WooCommerce.

== Description ==

This plugin integrates the ecollect payment gateway with WooCommerce, allowing merchants in Latin America to accept payments from customers using credit cards, PSE, SPEI, and other local payment methods.

Supported countries: Colombia, Mexico, Dominican Republic

Features:
* Credit card payments (Colombia, Mexico, Dominican Republic)
* PSE bank transfer (Colombia)
* SPEI interbank transfer (Mexico)
* Payment links via email, SMS, or QR
* Secure hosted checkout redirect
* Webhook support for real-time payment status updates

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/ecollect-woocommerce/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to WooCommerce > Settings > Payments > ecollect
4. Enter your API Key, Entity Code (ETY), Service Code (SRV), and select your environment
5. Save changes

== Frequently Asked Questions ==

= Where do I get my API credentials? =
Contact ecollect at https://www.e-collect.com to obtain your API Key and Entity Code.

= Is this plugin PCI compliant? =
Yes. Card data is handled by ecollect's secure hosted checkout page, never touching your server.

= What currencies are supported? =
COP (Colombian Peso), MXN (Mexican Peso), DOP (Dominican Peso), USD (US Dollar).

== Changelog ==

= 1.0.0 =
* Initial release

== Upgrade Notice ==

= 1.0.0 =
Initial release of the ecollect WooCommerce payment gateway plugin.

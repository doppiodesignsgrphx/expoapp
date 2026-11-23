<?php
/**
 * OEMS Expo App: allow the app's address to call this site's REST API.
 *
 * The Expo app runs on its own address, so the browser will only let it read
 * API responses if this site says that address is allowed. WordPress normally
 * does this itself, but most WP Event Manager routes end the request before
 * WordPress gets the chance, so the permission has to be sent earlier.
 *
 * Add the app's address to the list below. Use the exact origin: scheme and
 * host, no path and no trailing slash.
 *
 * If pasting into Code Snippets, leave out the opening <?php line.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function oems_expo_allowed_origins() {
	$origins = array(
		'http://localhost:5173', // Local development.
		'http://localhost:4173', // Local preview of a build.
		// 'https://YOUR-TEMPORARY-DOMAIN', // Staging app address. Add it here.
	);
	return apply_filters( 'oems_expo_allowed_origins', $origins );
}

add_action(
	'rest_api_init',
	function () {
		if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST || headers_sent() ) {
			return;
		}

		$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';
		if ( '' === $origin || ! in_array( untrailingslashit( $origin ), oems_expo_allowed_origins(), true ) ) {
			return;
		}

		header( 'Access-Control-Allow-Origin: ' . $origin );
		header( 'Vary: Origin', false );
		header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
		header( 'Access-Control-Allow-Headers: Authorization, Content-Type, Accept' );
		header( 'Access-Control-Max-Age: 600' );

		// Answer the browser's permission check directly.
		if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'OPTIONS' === $_SERVER['REQUEST_METHOD'] ) {
			status_header( 200 );
			exit;
		}
	},
	1
);

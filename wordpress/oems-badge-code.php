<?php
/**
 * OEMS Badge Code
 *
 * Gives every attendee registration a random 16-character badge code, so the
 * badge QR does not rely on guessable database IDs.
 *
 * - A new registration gets a code the moment it is created.
 * - Existing registrations are filled in automatically (in batches) the next
 *   time an administrator loads any wp-admin page.
 * - The code is kept in a private field that no form can write to, and copied
 *   into the visible custom property so it travels with the attendee object.
 *   If the visible copy is ever changed, it is put back.
 *
 * If pasting into Code Snippets, leave out the opening <?php line.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Both values confirmed against the staging site on 2026-11-23.
if ( ! defined( 'OEMS_BADGE_POST_TYPE' ) ) {
	define( 'OEMS_BADGE_POST_TYPE', 'event_registration' ); // Post type of an attendee registration.
}
if ( ! defined( 'OEMS_BADGE_PUBLIC_KEY' ) ) {
	define( 'OEMS_BADGE_PUBLIC_KEY', '_attendee_unique_id' ); // "Attendee Unique ID" registration field.
}

define( 'OEMS_BADGE_PRIVATE_KEY', '_oems_badge_code' ); // Authoritative copy. Not on any form.
define( 'OEMS_BADGE_LENGTH', 16 );

/**
 * Make one random code. Letters and digits only, without 0, O, 1 and I,
 * so a code can be read aloud or typed if a scan fails.
 */
function oems_badge_code_generate() {
	$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	$max      = strlen( $alphabet ) - 1;
	$code     = '';
	for ( $i = 0; $i < OEMS_BADGE_LENGTH; $i++ ) {
		$code .= $alphabet[ random_int( 0, $max ) ];
	}
	return $code;
}

/**
 * Find the registration that owns a code. Returns its ID, or 0 if none.
 */
function oems_badge_code_find( $code ) {
	$code = strtoupper( preg_replace( '/[^A-Za-z0-9]/', '', (string) $code ) );
	if ( strlen( $code ) !== OEMS_BADGE_LENGTH ) {
		return 0;
	}
	$found = get_posts(
		array(
			'post_type'        => OEMS_BADGE_POST_TYPE,
			'post_status'      => 'any',
			'posts_per_page'   => 1,
			'fields'           => 'ids',
			'meta_key'         => OEMS_BADGE_PRIVATE_KEY,
			'meta_value'       => $code,
			'suppress_filters' => true,
		)
	);
	return $found ? (int) $found[0] : 0;
}

/**
 * Give a registration a code if it does not have one. Returns the code.
 */
function oems_badge_code_assign( $registration_id ) {
	$code = get_post_meta( $registration_id, OEMS_BADGE_PRIVATE_KEY, true );

	if ( ! $code ) {
		do {
			$code = oems_badge_code_generate();
		} while ( oems_badge_code_find( $code ) );
		update_post_meta( $registration_id, OEMS_BADGE_PRIVATE_KEY, $code );
	}

	if ( get_post_meta( $registration_id, OEMS_BADGE_PUBLIC_KEY, true ) !== $code ) {
		$GLOBALS['oems_badge_code_syncing'] = true;
		update_post_meta( $registration_id, OEMS_BADGE_PUBLIC_KEY, $code );
		$GLOBALS['oems_badge_code_syncing'] = false;
	}

	return $code;
}

/**
 * New registration: assign a code as soon as it is created.
 */
add_action(
	'wp_insert_post',
	function ( $post_id, $post ) {
		if ( OEMS_BADGE_POST_TYPE === $post->post_type && ! wp_is_post_revision( $post_id ) ) {
			oems_badge_code_assign( $post_id );
		}
	},
	20,
	2
);

/**
 * Keep the visible copy honest. If a form, an import or an edit changes it,
 * restore the real code.
 */
function oems_badge_code_guard( $meta_id, $object_id, $meta_key ) {
	if ( OEMS_BADGE_PUBLIC_KEY !== $meta_key || ! empty( $GLOBALS['oems_badge_code_syncing'] ) ) {
		return;
	}
	if ( OEMS_BADGE_POST_TYPE === get_post_type( $object_id ) ) {
		oems_badge_code_assign( $object_id );
	}
}
add_action( 'added_post_meta', 'oems_badge_code_guard', 10, 3 );
add_action( 'updated_post_meta', 'oems_badge_code_guard', 10, 3 );

/**
 * Existing registrations: fill in codes 200 at a time until none are missing.
 */
add_action(
	'admin_init',
	function () {
		if ( ! current_user_can( 'manage_options' ) || get_option( 'oems_badge_code_backfilled' ) ) {
			return;
		}
		$missing = get_posts(
			array(
				'post_type'        => OEMS_BADGE_POST_TYPE,
				'post_status'      => 'any',
				'posts_per_page'   => 200,
				'fields'           => 'ids',
				'suppress_filters' => true,
				'meta_query'       => array(
					array(
						'key'     => OEMS_BADGE_PRIVATE_KEY,
						'compare' => 'NOT EXISTS',
					),
				),
			)
		);
		foreach ( $missing as $registration_id ) {
			oems_badge_code_assign( $registration_id );
		}
		if ( count( $missing ) < 200 ) {
			update_option( 'oems_badge_code_backfilled', 1, false );
		}
	}
);

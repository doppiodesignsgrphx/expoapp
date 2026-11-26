<?php
/**
 * OEMS Expo: point of sale and ticket transfers for the Expo app.
 *
 * Adds a small set of routes under /wp-json/oems-expo/v1 that the event plugin's
 * own API does not have:
 *
 *   POST /pos/orders             Staff create a ticket order at the desk.
 *   POST /pos/orders/{id}/paid   Staff record cash or a check as received.
 *   POST /pos/orders/{id}/text   Staff text the customer their link again.
 *   GET  /register/{id}?key=     The customer's phone reads what their order needs.
 *   POST /register/{id}?key=     The customer sends the attendee details.
 *   POST /transfers              Staff move a ticket to another person.
 *
 * Nothing here handles card numbers. A card is always paid on WooCommerce's own
 * payment page for the order.
 *
 * Staff routes need the same sign-in token the app already uses. The customer
 * routes need the order's own key, which only the person holding the link has.
 *
 * Needs: WooCommerce, WP Event Manager, the Registrations and Sell Tickets
 * add-ons, and the REST API add-on. Texts use the SMS Notifications add-on.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'OEMS_POS_NAMESPACE', 'oems-expo/v1' );

/**
 * Where the app lives. Links texted to customers point here.
 * Change with the oems_expo_app_url filter when the app moves to its final address.
 */
function oems_pos_app_url() {
	return untrailingslashit( apply_filters( 'oems_expo_app_url', 'https://savvy-coral-mongoose-81.hostingersite.com' ) );
}

add_action( 'rest_api_init', 'oems_pos_register_routes' );

function oems_pos_register_routes() {
	$id = '(?P<id>\d+)';

	register_rest_route( OEMS_POS_NAMESPACE, '/pos/orders', array(
		'methods'             => 'POST',
		'callback'            => 'oems_pos_create_order',
		'permission_callback' => 'oems_pos_staff_only',
	) );
	register_rest_route( OEMS_POS_NAMESPACE, "/pos/orders/$id/paid", array(
		'methods'             => 'POST',
		'callback'            => 'oems_pos_mark_paid',
		'permission_callback' => 'oems_pos_staff_only',
	) );
	register_rest_route( OEMS_POS_NAMESPACE, "/pos/orders/$id/text", array(
		'methods'             => 'POST',
		'callback'            => 'oems_pos_text_again',
		'permission_callback' => 'oems_pos_staff_only',
	) );
	register_rest_route( OEMS_POS_NAMESPACE, "/register/$id", array(
		array(
			'methods'             => 'GET',
			'callback'            => 'oems_pos_register_read',
			'permission_callback' => 'oems_pos_holds_order_key',
		),
		array(
			'methods'             => 'POST',
			'callback'            => 'oems_pos_register_save',
			'permission_callback' => 'oems_pos_holds_order_key',
		),
	) );
	register_rest_route( OEMS_POS_NAMESPACE, '/transfers', array(
		'methods'             => 'POST',
		'callback'            => 'oems_pos_transfer',
		'permission_callback' => 'oems_pos_staff_only',
	) );
}

/* ---------------------------------------------------------------------------
 * Who may call what
 * ------------------------------------------------------------------------- */

/**
 * Staff routes: the request must carry the app's sign-in token, and the account
 * behind it must be able to edit posts. Attendee accounts cannot.
 * Change the required ability with the oems_expo_pos_capability filter.
 */
function oems_pos_staff_only( WP_REST_Request $request ) {
	if ( ! class_exists( 'WPEM_REST_CRUD_Controller' ) ) {
		return new WP_Error( 'oems_pos_missing_api', 'The event API add-on is not active.', array( 'status' => 503 ) );
	}

	$header = $request->get_header( 'authorization' );
	$token  = trim( preg_replace( '/^Bearer\s+/i', '', (string) $header ) );
	$claims = $token ? WPEM_REST_CRUD_Controller::wpem_validate_jwt_token( $token ) : false;
	if ( ! is_array( $claims ) ) {
		return new WP_Error( 'oems_pos_signin', 'Sign in again.', array( 'status' => 401 ) );
	}

	$user = false;
	foreach ( array( 'id', 'user_id' ) as $key ) {
		if ( ! $user && ! empty( $claims[ $key ] ) ) {
			$user = get_user_by( 'id', (int) $claims[ $key ] );
		}
	}
	foreach ( array( 'username', 'user_login', 'login' ) as $key ) {
		if ( ! $user && ! empty( $claims[ $key ] ) ) {
			$user = get_user_by( 'login', (string) $claims[ $key ] );
		}
	}
	if ( ! $user && ! empty( $claims['email'] ) ) {
		$user = get_user_by( 'email', (string) $claims['email'] );
	}
	if ( ! $user ) {
		return new WP_Error( 'oems_pos_signin', 'Sign in again.', array( 'status' => 401 ) );
	}

	if ( ! user_can( $user, apply_filters( 'oems_expo_pos_capability', 'edit_posts' ) ) ) {
		return new WP_Error( 'oems_pos_forbidden', 'This account cannot sell or transfer tickets.', array( 'status' => 403 ) );
	}

	wp_set_current_user( $user->ID );
	return true;
}

/**
 * Customer routes: the link must carry the order's own key.
 */
function oems_pos_holds_order_key( WP_REST_Request $request ) {
	$order = function_exists( 'wc_get_order' ) ? wc_get_order( (int) $request['id'] ) : false;
	$key   = (string) $request->get_param( 'key' );
	if ( ! $order || '' === $key || ! hash_equals( (string) $order->get_order_key(), $key ) ) {
		return new WP_Error( 'oems_pos_link', 'This link is not valid.', array( 'status' => 403 ) );
	}
	return true;
}

/* ---------------------------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------------------------- */

function oems_pos_text( $value ) {
	return sanitize_text_field( wp_unslash( (string) $value ) );
}

/** A phone number as digits with a leading plus. US numbers typed without a country code get +1. */
function oems_pos_phone( $value ) {
	$digits = preg_replace( '/\D+/', '', (string) $value );
	if ( '' === $digits ) {
		return '';
	}
	if ( 10 === strlen( $digits ) ) {
		$digits = '1' . $digits;
	}
	return '+' . $digits;
}

/** One person's details, cleaned. */
function oems_pos_person( $raw ) {
	$raw = is_array( $raw ) ? $raw : array();
	return array(
		'first_name' => oems_pos_text( $raw['first_name'] ?? '' ),
		'last_name'  => oems_pos_text( $raw['last_name'] ?? '' ),
		'email'      => sanitize_email( (string) ( $raw['email'] ?? '' ) ),
		'phone'      => oems_pos_phone( $raw['phone'] ?? '' ),
	);
}

/** The ticket lines on an order, one entry per single ticket. */
function oems_pos_ticket_units( WC_Order $order ) {
	$units = array();
	foreach ( $order->get_items() as $item ) {
		$ticket_id = (int) $item->get_product_id();
		$event_id  = (int) get_post_meta( $ticket_id, '_event_id', true );
		if ( ! $event_id ) {
			continue;
		}
		$each = $item->get_quantity() ? (float) $item->get_total() / $item->get_quantity() : 0;
		for ( $i = 0; $i < $item->get_quantity(); $i++ ) {
			$units[] = array(
				'ticket_id'   => $ticket_id,
				'ticket_name' => $item->get_name(),
				'ticket_type' => (string) get_post_meta( $ticket_id, '_ticket_type', true ),
				'event_id'    => $event_id,
				'price'       => wc_format_decimal( $each, 2 ),
			);
		}
	}
	return $units;
}

/** Registrations already made for an order. */
function oems_pos_order_registrations( $order_id ) {
	return get_posts( array(
		'post_type'        => 'event_registration',
		'post_status'      => 'any',
		'posts_per_page'   => -1,
		'fields'           => 'ids',
		'orderby'          => 'ID',
		'order'            => 'ASC',
		'meta_key'         => '_order_id',
		'meta_value'       => (string) $order_id,
		'suppress_filters' => true,
	) );
}

/**
 * Create the registrations for an order, one per ticket, in the order given.
 * Stops at the number of tickets that still have no registration.
 * Returns the new registration IDs, or a WP_Error.
 */
function oems_pos_create_registrations( WC_Order $order, array $attendees ) {
	if ( ! function_exists( 'create_event_registration' ) ) {
		return new WP_Error( 'oems_pos_missing_registrations', 'The Registrations add-on is not active.', array( 'status' => 503 ) );
	}

	$units = oems_pos_ticket_units( $order );
	$done  = count( oems_pos_order_registrations( $order->get_id() ) );
	$open  = array_slice( $units, $done );
	if ( count( $attendees ) > count( $open ) ) {
		return new WP_Error( 'oems_pos_too_many', 'There are more attendees than tickets left on this order.', array( 'status' => 400 ) );
	}

	$made = array();
	foreach ( array_values( $attendees ) as $i => $raw ) {
		$who = oems_pos_person( $raw );
		if ( '' === $who['first_name'] || '' === $who['last_name'] || ! is_email( $who['email'] ) ) {
			return new WP_Error( 'oems_pos_attendee', sprintf( 'Attendee %d needs a first name, a last name and a valid email.', $i + 1 ), array( 'status' => 400 ) );
		}
		$unit = $open[ $i ];

		$fields = array(
			'attendee_name'      => $who['first_name'],
			'attendee_last_name' => $who['last_name'],
			'attendee_email'     => $who['email'],
			'attendee_phone'     => $who['phone'],
		);
		$meta = array(
			'_ticket_type'        => array( $unit['ticket_type'] ),
			'_ticket_id'          => array( $unit['ticket_id'] ),
			'_order_id'           => $order->get_id(),
			'_total_ticket_price' => $unit['price'],
			'_total_ticket'       => 1,
			'_registration_type'  => 0,
		);

		try {
			$registration_id = create_event_registration( $unit['event_id'], $fields, $meta, true, 'oems-expo-app' );
		} catch ( Exception $e ) {
			return new WP_Error( 'oems_pos_registration', $e->getMessage(), array( 'status' => 400 ) );
		}
		if ( ! $registration_id ) {
			return new WP_Error( 'oems_pos_registration', 'The registration could not be created.', array( 'status' => 500 ) );
		}
		$made[] = (int) $registration_id;
	}
	return $made;
}

/** The link a customer opens on their phone to enter attendee details. */
function oems_pos_form_url( WC_Order $order ) {
	return oems_pos_app_url() . '/#/register/' . $order->get_id() . '/' . rawurlencode( $order->get_order_key() );
}

/** Send one text. Returns true when the SMS add-on accepted it. */
function oems_pos_send_text( $to, $message ) {
	if ( '' === $to || ! function_exists( 'wpem_sms_notifications_send_sms' ) ) {
		return false;
	}
	return (bool) wpem_sms_notifications_send_sms( get_current_user_id(), $to, $message, array( 'type' => 'oems_expo_pos' ) );
}

/** What is still unpaid and what the customer should be sent. */
function oems_pos_customer_text( WC_Order $order, $needs_details, $needs_payment ) {
	if ( $needs_details ) {
		return sprintf( 'NC EMS Expo: finish your registration here. %s', oems_pos_form_url( $order ) );
	}
	if ( $needs_payment ) {
		return sprintf( 'NC EMS Expo: pay for your order here. %s', $order->get_checkout_payment_url() );
	}
	return '';
}

/** The order as the app needs to see it. */
function oems_pos_order_summary( WC_Order $order ) {
	$units = oems_pos_ticket_units( $order );
	$made  = oems_pos_order_registrations( $order->get_id() );
	return array(
		'order_id'          => $order->get_id(),
		'status'            => $order->get_status(),
		'total'             => wc_format_decimal( $order->get_total(), 2 ),
		'paid'              => (bool) $order->get_date_paid(),
		'payment_method'    => $order->get_payment_method(),
		'tickets'           => count( $units ),
		'registration_ids'  => array_map( 'intval', $made ),
		'details_missing'   => max( 0, count( $units ) - count( $made ) ),
		'pay_url'           => $order->needs_payment() ? $order->get_checkout_payment_url() : '',
		'form_url'          => oems_pos_form_url( $order ),
	);
}

/* ---------------------------------------------------------------------------
 * Staff: create an order
 * ------------------------------------------------------------------------- */

/**
 * Body:
 *   event_id   the event the tickets belong to
 *   items      [ { ticket_id, quantity } ]
 *   buyer      { first_name, last_name, phone, email }
 *   attendees  [ { first_name, last_name, email, phone } ]  one per ticket, or empty
 *              when the customer will fill them in on their phone
 *   payment    card | pay_later | cash | check
 *   send_text  true to text the customer their link
 */
function oems_pos_create_order( WP_REST_Request $request ) {
	if ( ! function_exists( 'wc_create_order' ) ) {
		return new WP_Error( 'oems_pos_missing_woo', 'WooCommerce is not active.', array( 'status' => 503 ) );
	}

	$body     = (array) $request->get_json_params();
	$event_id = (int) ( $body['event_id'] ?? 0 );
	$items    = is_array( $body['items'] ?? null ) ? $body['items'] : array();
	$buyer    = oems_pos_person( $body['buyer'] ?? array() );
	$people   = is_array( $body['attendees'] ?? null ) ? $body['attendees'] : array();
	$payment  = (string) ( $body['payment'] ?? 'card' );
	$text     = ! empty( $body['send_text'] );

	if ( ! in_array( $payment, array( 'card', 'pay_later', 'cash', 'check' ), true ) ) {
		return new WP_Error( 'oems_pos_payment', 'Choose how this order will be paid.', array( 'status' => 400 ) );
	}
	if ( 'event_listing' !== get_post_type( $event_id ) ) {
		return new WP_Error( 'oems_pos_event', 'That event was not found.', array( 'status' => 400 ) );
	}
	if ( '' === $buyer['first_name'] || '' === $buyer['last_name'] || '' === $buyer['phone'] ) {
		return new WP_Error( 'oems_pos_buyer', 'The buyer needs a first name, a last name and a phone number.', array( 'status' => 400 ) );
	}

	// Check every line before anything is created.
	$lines = array();
	$count = 0;
	foreach ( $items as $item ) {
		$ticket_id = (int) ( $item['ticket_id'] ?? 0 );
		$quantity  = (int) ( $item['quantity'] ?? 0 );
		if ( $quantity < 1 ) {
			continue;
		}
		$product = wc_get_product( $ticket_id );
		if ( ! $product || (int) get_post_meta( $ticket_id, '_event_id', true ) !== $event_id ) {
			return new WP_Error( 'oems_pos_ticket', 'One of the tickets does not belong to this event.', array( 'status' => 400 ) );
		}
		if ( ! $product->has_enough_stock( $quantity ) ) {
			return new WP_Error( 'oems_pos_stock', sprintf( 'Not enough "%s" tickets are left.', $product->get_name() ), array( 'status' => 409 ) );
		}
		$lines[] = array( $product, $quantity );
		$count  += $quantity;
	}
	if ( 0 === $count ) {
		return new WP_Error( 'oems_pos_empty', 'Add at least one ticket.', array( 'status' => 400 ) );
	}
	if ( $people && count( $people ) !== $count ) {
		return new WP_Error( 'oems_pos_people', 'Enter details for every ticket, or send the form to the customer instead.', array( 'status' => 400 ) );
	}

	$order = wc_create_order( array( 'status' => 'pending', 'created_via' => 'oems-expo-app' ) );
	if ( is_wp_error( $order ) ) {
		return $order;
	}
	foreach ( $lines as $line ) {
		$order->add_product( $line[0], $line[1] );
	}
	$order->set_billing_first_name( $buyer['first_name'] );
	$order->set_billing_last_name( $buyer['last_name'] );
	$order->set_billing_phone( $buyer['phone'] );
	if ( is_email( $buyer['email'] ) ) {
		$order->set_billing_email( $buyer['email'] );
	}
	$order->update_meta_data( '_event_id', serialize( array( $event_id ) ) );
	$order->update_meta_data( '_oems_pos_staff', get_current_user_id() );
	$order->calculate_totals();
	$order->save();
	$order->add_order_note( 'Created at the registration desk in the Expo app.' );

	// Attendee details given at the desk become registrations now.
	if ( $people ) {
		$made = oems_pos_create_registrations( $order, $people );
		if ( is_wp_error( $made ) ) {
			$order->update_status( 'cancelled', 'Cancelled: the attendee details could not be saved.' );
			return $made;
		}
	}

	// Payment. Changing the order status is what tells the event plugin to update the registrations.
	if ( 'pay_later' === $payment ) {
		$order->set_payment_method( 'cod' );
		$order->set_payment_method_title( 'Pay at registration' );
		$order->save();
		$order->update_status( 'processing', 'Outstanding balance: to be paid at registration.' );
	} elseif ( 'cash' === $payment || 'check' === $payment ) {
		oems_pos_record_payment( $order, $payment );
	}
	// A card order stays pending until the customer pays on the payment page.

	$order   = wc_get_order( $order->get_id() );
	$summary = oems_pos_order_summary( $order );

	$summary['text_sent'] = false;
	if ( $text ) {
		$message = oems_pos_customer_text( $order, $summary['details_missing'] > 0, 'card' === $payment );
		if ( '' !== $message ) {
			$summary['text_sent'] = oems_pos_send_text( $buyer['phone'], $message );
		}
	}

	return rest_ensure_response( $summary );
}

/** Record cash or a check as received, which completes the order. */
function oems_pos_record_payment( WC_Order $order, $method ) {
	$order->set_payment_method( 'check' === $method ? 'cheque' : 'cod' );
	$order->set_payment_method_title( 'check' === $method ? 'Check at registration' : 'Cash at registration' );
	$order->save();
	$order->payment_complete();
	$order->update_status( 'completed', sprintf( '%s received at the registration desk.', 'check' === $method ? 'Check' : 'Cash' ) );
}

/* ---------------------------------------------------------------------------
 * Staff: mark paid, text again
 * ------------------------------------------------------------------------- */

function oems_pos_mark_paid( WP_REST_Request $request ) {
	$order  = wc_get_order( (int) $request['id'] );
	$body   = (array) $request->get_json_params();
	$method = (string) ( $body['method'] ?? 'cash' );
	if ( ! $order ) {
		return new WP_Error( 'oems_pos_order', 'That order was not found.', array( 'status' => 404 ) );
	}
	if ( ! in_array( $method, array( 'cash', 'check' ), true ) ) {
		return new WP_Error( 'oems_pos_payment', 'Choose cash or check.', array( 'status' => 400 ) );
	}
	if ( $order->get_date_paid() || in_array( $order->get_status(), array( 'completed', 'refunded', 'cancelled' ), true ) ) {
		return new WP_Error( 'oems_pos_settled', 'This order is already settled.', array( 'status' => 409 ) );
	}
	oems_pos_record_payment( $order, $method );
	return rest_ensure_response( oems_pos_order_summary( wc_get_order( $order->get_id() ) ) );
}

function oems_pos_text_again( WP_REST_Request $request ) {
	$order = wc_get_order( (int) $request['id'] );
	if ( ! $order ) {
		return new WP_Error( 'oems_pos_order', 'That order was not found.', array( 'status' => 404 ) );
	}
	$summary = oems_pos_order_summary( $order );
	$message = oems_pos_customer_text( $order, $summary['details_missing'] > 0, $order->needs_payment() );
	if ( '' === $message ) {
		return new WP_Error( 'oems_pos_nothing', 'This order has nothing left for the customer to do.', array( 'status' => 409 ) );
	}
	$summary['text_sent'] = oems_pos_send_text( $order->get_billing_phone(), $message );
	return rest_ensure_response( $summary );
}

/* ---------------------------------------------------------------------------
 * Customer: fill in attendee details from the texted link
 * ------------------------------------------------------------------------- */

function oems_pos_register_read( WP_REST_Request $request ) {
	$order   = wc_get_order( (int) $request['id'] );
	$summary = oems_pos_order_summary( $order );
	$units   = oems_pos_ticket_units( $order );
	$open    = array_slice( $units, count( $summary['registration_ids'] ) );

	$event_id = $units ? $units[0]['event_id'] : 0;
	return rest_ensure_response( array(
		'event_name'      => $event_id ? get_the_title( $event_id ) : '',
		'buyer'           => array(
			'first_name' => $order->get_billing_first_name(),
			'last_name'  => $order->get_billing_last_name(),
			'phone'      => $order->get_billing_phone(),
			'email'      => $order->get_billing_email(),
		),
		'tickets'         => array_map( function ( $unit ) {
			return array( 'ticket_name' => $unit['ticket_name'] );
		}, $open ),
		'details_missing' => $summary['details_missing'],
		'total'           => $summary['total'],
		'paid'            => $summary['paid'],
		'status'          => $summary['status'],
		'pay_url'         => $summary['pay_url'],
	) );
}

function oems_pos_register_save( WP_REST_Request $request ) {
	$order = wc_get_order( (int) $request['id'] );
	if ( in_array( $order->get_status(), array( 'cancelled', 'refunded', 'failed' ), true ) ) {
		return new WP_Error( 'oems_pos_closed', 'This order is closed. Ask the registration desk for help.', array( 'status' => 409 ) );
	}

	$body   = (array) $request->get_json_params();
	$people = is_array( $body['attendees'] ?? null ) ? $body['attendees'] : array();
	if ( ! $people ) {
		return new WP_Error( 'oems_pos_people', 'Enter the attendee details.', array( 'status' => 400 ) );
	}

	$made = oems_pos_create_registrations( $order, $people );
	if ( is_wp_error( $made ) ) {
		return $made;
	}
	$order->add_order_note( sprintf( '%d attendee(s) entered from the texted link.', count( $made ) ) );

	// Registrations made after the order was paid or set aside need the matching status.
	// Saving the same order status again does not fire the event plugin's update, so set it here.
	$status_for = array( 'completed' => 'confirmed', 'processing' => 'new', 'on-hold' => 'waiting', 'pending' => 'waiting' );
	$status     = $status_for[ $order->get_status() ] ?? '';
	if ( '' !== $status ) {
		foreach ( $made as $registration_id ) {
			wp_update_post( array( 'ID' => $registration_id, 'post_status' => $status ) );
		}
	}

	return oems_pos_register_read( $request );
}

/* ---------------------------------------------------------------------------
 * Staff: transfer a ticket to another person
 * ------------------------------------------------------------------------- */

/**
 * Body:
 *   registration_id  the registration (ticket) to move
 *   to               { first_name, last_name, email, phone }  the new holder
 *   send_text        true to text the new holder
 *
 * The registration keeps its ticket and its order. The person on it changes,
 * any check-in is cleared, and the badge code is replaced so the old badge
 * stops working.
 */
function oems_pos_transfer( WP_REST_Request $request ) {
	$body = (array) $request->get_json_params();
	$id   = (int) ( $body['registration_id'] ?? 0 );
	$to   = oems_pos_person( $body['to'] ?? array() );

	if ( 'event_registration' !== get_post_type( $id ) ) {
		return new WP_Error( 'oems_pos_registration', 'That registration was not found.', array( 'status' => 404 ) );
	}
	if ( '' === $to['first_name'] || '' === $to['last_name'] || ! is_email( $to['email'] ) ) {
		return new WP_Error( 'oems_pos_attendee', 'The new ticket holder needs a first name, a last name and a valid email.', array( 'status' => 400 ) );
	}

	$from = trim( get_post_meta( $id, '_attendee_name', true ) . ' ' . get_post_meta( $id, '_attendee_last_name', true ) );
	$from_email = (string) get_post_meta( $id, '_attendee_email', true );

	update_post_meta( $id, '_attendee_name', $to['first_name'] );
	update_post_meta( $id, '_attendee_last_name', $to['last_name'] );
	update_post_meta( $id, '_attendee_email', $to['email'] );
	update_post_meta( $id, '_attendee_phone', $to['phone'] );
	wp_update_post( array( 'ID' => $id, 'post_title' => trim( $to['first_name'] . ' ' . $to['last_name'] ) ) );

	// The new holder has not checked in.
	delete_post_meta( $id, '_check_in' );
	delete_post_meta( $id, '_checkin_time' );

	// Replace the badge code, when the badge code snippet is installed.
	$code = '';
	if ( function_exists( 'oems_badge_code_assign' ) && defined( 'OEMS_BADGE_PRIVATE_KEY' ) ) {
		delete_post_meta( $id, OEMS_BADGE_PRIVATE_KEY );
		$code = oems_badge_code_assign( $id );
	}

	// Keep a record on the registration itself, in the event plugin's own notes.
	$staff = wp_get_current_user();
	wp_insert_comment( array(
		'comment_post_ID'  => $id,
		'comment_author'   => $staff->display_name,
		'comment_content'  => sprintf( 'Ticket transferred from %s (%s) to %s %s (%s) in the Expo app.', $from, $from_email, $to['first_name'], $to['last_name'], $to['email'] ),
		'comment_type'     => 'event_registration',
		'comment_approved' => 1,
		'user_id'          => $staff->ID,
	) );

	$texted = false;
	if ( ! empty( $body['send_text'] ) && '' !== $to['phone'] ) {
		$event  = get_the_title( wp_get_post_parent_id( $id ) );
		$texted = oems_pos_send_text( $to['phone'], sprintf( 'NC EMS Expo: a ticket for %s has been transferred to you. Bring a photo ID to registration to pick up your badge.', $event ) );
	}

	return rest_ensure_response( array(
		'registration_id' => $id,
		'event_id'        => (int) wp_get_post_parent_id( $id ),
		'from'            => $from,
		'to'              => trim( $to['first_name'] . ' ' . $to['last_name'] ),
		'badge_code'      => $code,
		'text_sent'       => $texted,
	) );
}

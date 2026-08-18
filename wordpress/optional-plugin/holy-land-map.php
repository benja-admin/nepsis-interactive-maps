<?php
/**
 * Plugin Name:  Nepsis Ministries Holy Land Map
 * Plugin URI:   https://github.com/YOURNAME/nepsis-map
 * Description:  A realistic 3D terrain map of the Bible lands with 150 sites, era filtering and scripture references. Add it to any page with the [holy_land_map] shortcode.
 * Version:      1.0.0
 * Requires PHP: 7.0
 * Author:       Nepsis Ministries
 * License:      MIT
 * License URI:  https://opensource.org/licenses/MIT
 * Text Domain:  holy-land-map
 *
 * ==================================================================
 *  INSTALL
 * ==================================================================
 *  Easiest - the packaged ZIP:
 *    WordPress admin → Plugins → Add New → Upload Plugin →
 *    choose holy-land-map.zip → Install Now → Activate.
 *    The map files travel inside the plugin. Nothing else to upload.
 *
 *  Manual - if you prefer the map outside WordPress:
 *    1. Upload the map folder to  public_html/holy-land-map/
 *    2. Upload this file to       wp-content/plugins/holy-land-map.php
 *    3. Activate it in Plugins.
 *    The plugin notices there is no bundled map/ folder and falls back
 *    to /holy-land-map/ automatically.
 *
 * ==================================================================
 *  USAGE
 * ==================================================================
 *    [holy_land_map]
 *    [holy_land_map height="600px"]
 *    [holy_land_map view="galilee" era="gospels"]
 *    [holy_land_map site="capernaum" height="70vh" caption="no"]
 *    [holy_land_map view="jerusalem" basemap="relief" exag="3" fullwidth="yes"]
 *    [holy_land_map path="https://map.yoursite.com/"]    map hosted elsewhere
 *
 *  ATTRIBUTES
 *    path       where the map lives. Defaults to the copy bundled with
 *               this plugin. Accepts a server folder ("/holy-land-map/")
 *               or a full URL ("https://map.yoursite.com/").
 *    height     CSS height of the embed             default 78vh
 *    minheight  floor for short screens             default 480px
 *    view       all | levant | galilee | jerusalem | rift | sinai | aegean
 *    era        patriarchs | exodus | judges | united | divided | exile |
 *               intertest | gospels | acts | all
 *    site       a site id, e.g. capernaum, jerusalem, mount-sinai
 *    basemap    satellite | relief | topo | parchment
 *    exag       terrain exaggeration, 0 to 6
 *    caption    yes | no                            default yes
 *    fullwidth  yes | no - break out of the content column   default no
 *    class      extra CSS class on the wrapper
 *
 *  For developers: filter `hl3d_map_root` to point at any other URL.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // no direct access
}

define( 'HL3D_VERSION', '1.0.0' );

/** Fallback used when the map is NOT bundled inside the plugin. */
define( 'HL3D_FALLBACK_PATH', '/holy-land-map/' );

/**
 * Where the map files live, as a URL ending in a slash.
 *
 * Prefers the copy bundled inside this plugin. If the plugin was installed
 * as a bare PHP file (no map/ subfolder), falls back to a folder at the web
 * root so both install methods work from one file.
 *
 * @return string
 */
function hl3d_map_root() {
	static $root = null;

	if ( null === $root ) {
		if ( file_exists( plugin_dir_path( __FILE__ ) . 'map/index.html' ) ) {
			$root = plugin_dir_url( __FILE__ ) . 'map/';
		} else {
			$root = HL3D_FALLBACK_PATH;
		}
	}

	/**
	 * Filter the base URL of the map.
	 * Example: add_filter( 'hl3d_map_root', fn() => 'https://map.example.com/' );
	 */
	return apply_filters( 'hl3d_map_root', $root );
}

/** True when the map files ship inside this plugin. */
function hl3d_is_bundled() {
	return file_exists( plugin_dir_path( __FILE__ ) . 'map/index.html' );
}

/**
 * Render the [holy_land_map] shortcode.
 *
 * @param  array $atts Shortcode attributes.
 * @return string HTML.
 */
function hl3d_render_map( $atts = array() ) {

	$a = shortcode_atts(
		array(
			'path'      => '',
			'height'    => '78vh',
			'minheight' => '480px',
			'view'      => '',
			'era'       => '',
			'site'      => '',
			'basemap'   => '',
			'exag'      => '',
			'caption'   => 'yes',
			'fullwidth' => 'no',
			'class'     => '',
		),
		$atts,
		'holy_land_map'
	);

	// --- whitelist everything that reaches the URL ---------------------
	$views    = array( 'all', 'levant', 'galilee', 'jerusalem', 'rift', 'sinai', 'aegean' );
	$eras     = array(
		'patriarchs', 'exodus', 'judges', 'united', 'divided',
		'exile', 'intertest', 'gospels', 'acts', 'all',
	);
	$basemaps = array( 'satellite', 'relief', 'topo', 'parchment' );

	$query = array(
		'embed' => '1',
		'v'     => HL3D_VERSION,   // cache-bust when the plugin is updated
	);

	if ( in_array( $a['view'], $views, true ) ) {
		$query['view'] = $a['view'];
	}
	if ( in_array( $a['era'], $eras, true ) ) {
		$query['era'] = $a['era'];
	}
	if ( in_array( $a['basemap'], $basemaps, true ) ) {
		$query['basemap'] = $a['basemap'];
	}
	if ( '' !== $a['site'] && preg_match( '/^[a-z0-9-]{2,60}$/', $a['site'] ) ) {
		$query['site'] = $a['site'];
	}
	if ( '' !== $a['exag'] && is_numeric( $a['exag'] ) ) {
		$query['exag'] = (string) max( 0, min( 6, (float) $a['exag'] ) );
	}

	// --- resolve the base URL ------------------------------------------
	if ( '' === $a['path'] ) {
		$root = hl3d_map_root();
	} elseif ( preg_match( '#^https?://#i', $a['path'] ) ) {
		$root = trailingslashit( esc_url_raw( $a['path'] ) );
	} else {
		$root = '/' . trim( $a['path'], '/' ) . '/';
	}

	$src = $root . 'index.html?' . http_build_query( $query );

	// --- sanitise the CSS values ---------------------------------------
	$height    = preg_match( '/^[0-9.]+(px|vh|rem|em|%)$/', $a['height'] ) ? $a['height'] : '78vh';
	$minheight = preg_match( '/^[0-9.]+(px|vh|rem|em|%)$/', $a['minheight'] ) ? $a['minheight'] : '480px';

	$classes = 'hl3d-embed';
	if ( 'yes' === $a['fullwidth'] || 'true' === $a['fullwidth'] ) {
		$classes .= ' hl3d-fullwidth';
	}
	if ( $a['class'] ) {
		$classes .= ' ' . sanitize_html_class( $a['class'] );
	}

	$style = sprintf( 'height:%s;min-height:%s;', esc_attr( $height ), esc_attr( $minheight ) );

	// --- output ---------------------------------------------------------
	ob_start();
	?>
	<div class="<?php echo esc_attr( $classes ); ?>" style="<?php echo esc_attr( $style ); ?>">
		<iframe
			src="<?php echo esc_url( $src ); ?>"
			title="<?php esc_attr_e( 'Nepsis Ministries — interactive 3D map of the Holy Land', 'holy-land-map' ); ?>"
			loading="lazy"
			allowfullscreen
			allow="fullscreen"></iframe>
	</div>
	<?php if ( 'no' !== $a['caption'] && 'false' !== $a['caption'] ) : ?>
		<p class="hl3d-caption">
			<?php esc_html_e( 'Drag to pan · Ctrl (or ⌘) + scroll to zoom · right-drag to tilt and rotate. Use the timeline to filter by era and click any marker for its scripture references.', 'holy-land-map' ); ?>
			<a href="<?php echo esc_url( $root ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Open full-screen ↗', 'holy-land-map' ); ?></a>
		</p>
	<?php endif; ?>
	<?php
	return ob_get_clean();
}
add_shortcode( 'holy_land_map', 'hl3d_render_map' );

/**
 * Styles. Registered against a dummy handle so WordPress prints this small
 * block of CSS once, inline in the head. Under 700 bytes, so there is no
 * separate HTTP request and no reason to load it conditionally.
 */
function hl3d_register_styles() {
	wp_register_style( 'hl3d', false, array(), HL3D_VERSION );
	wp_enqueue_style( 'hl3d' );
	wp_add_inline_style(
		'hl3d',
		'.hl3d-embed{position:relative;width:100%;max-height:900px;margin:0 0 .75rem;' .
		'border-radius:12px;overflow:hidden;background:#0b1017;box-shadow:0 6px 28px rgba(0,0,0,.22)}' .
		'.hl3d-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}' .
		'.hl3d-caption{font-size:.85rem;opacity:.75;line-height:1.5;margin-top:0}' .
		'.hl3d-fullwidth{width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);' .
		'margin-right:calc(50% - 50vw);border-radius:0}' .
		'@media(max-width:782px){.hl3d-embed{border-radius:8px}}'
	);
}
add_action( 'wp_enqueue_scripts', 'hl3d_register_styles' );

/**
 * Handy links on the Plugins screen.
 *
 * @param  array $links Existing links.
 * @return array
 */
function hl3d_plugin_links( $links ) {
	array_unshift(
		$links,
		'<a href="' . esc_url( hl3d_map_root() ) . '" target="_blank" rel="noopener">' .
		esc_html__( 'Open map', 'holy-land-map' ) . '</a>'
	);
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'hl3d_plugin_links' );

/**
 * If the plugin was installed as a bare PHP file, remind the admin that the
 * map folder still has to be uploaded - otherwise the shortcode renders an
 * empty box and the cause is not obvious.
 */
function hl3d_admin_notice() {
	if ( hl3d_is_bundled() || ! current_user_can( 'activate_plugins' ) ) {
		return;
	}
	$screen = get_current_screen();
	if ( ! $screen || 'plugins' !== $screen->id ) {
		return;
	}
	echo '<div class="notice notice-info"><p><strong>Nepsis Ministries Holy Land Map:</strong> ';
	printf(
		/* translators: %s: expected folder path */
		esc_html__( 'no bundled map found, so the shortcode will look for the map at %s. Upload the map folder there, or use the packaged ZIP version of this plugin instead.', 'holy-land-map' ),
		'<code>' . esc_html( HL3D_FALLBACK_PATH ) . '</code>'
	);
	echo '</p></div>';
}
add_action( 'admin_notices', 'hl3d_admin_notice' );

/*
 * TROUBLESHOOTING: iframe renders as a blank / dark box
 * ----------------------------------------------------
 * Almost always X-Frame-Options: DENY, set site-wide by a security plugin
 * (Wordfence, iThemes, All In One WP Security) or by your host.
 *
 * That header is sent by Apache for the *static* map files, not by
 * WordPress, so no PHP filter here can undo it. Fix it in the map folder's
 * own .htaccess instead - the .htaccess shipped inside map/ already
 * contains the right rule:
 *
 *     Header always set X-Frame-Options "SAMEORIGIN"
 *
 * SAMEORIGIN keeps the clickjacking protection (nobody else can frame your
 * site) while allowing your own pages to embed the map.
 */

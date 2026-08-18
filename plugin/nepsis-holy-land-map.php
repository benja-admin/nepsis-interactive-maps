<?php
/**
 * Plugin Name:  Nepsis Ministries Holy Land Map
 * Plugin URI:   https://github.com/YOURNAME/nepsis-map
 * Description:  A realistic 3D terrain map of the Holy Land with 150 sites, era filtering and scripture references. Put [nepsis_map] on a page and that page becomes the map, edge to edge, with your theme's header and footer removed.
 * Version:      2.3.0
 * Requires PHP: 7.0
 * Author:       Nepsis Ministries
 * License:      MIT
 * License URI:  https://opensource.org/licenses/MIT
 * Text Domain:  nepsis-map
 *
 * ==================================================================
 *  INSTALL
 * ==================================================================
 *  Plugins → Add New Plugin → Upload Plugin → nepsis-holy-land-map.zip
 *  → Install Now → Activate.
 *
 *  Then create a page (Pages → Add New), put [nepsis_map] in it, and
 *  publish. Visiting that page shows the map full screen. The theme's
 *  header, footer, sidebars and admin bar are all bypassed, because the
 *  plugin swaps out the page template entirely rather than trying to
 *  hide things with CSS.
 *
 * ==================================================================
 *  SHORTCODE
 * ==================================================================
 *    [nepsis_map]                        full-page map (the default)
 *    [nepsis_map back="no"]              hide the back arrow
 *    [nepsis_map back="/resources/"]     back arrow always returns here
 *    [nepsis_map view="galilee" era="gospels"]
 *    [nepsis_map site="capernaum"]
 *    [nepsis_map basemap="relief" exag="3"]
 *
 *    [nepsis_map fullpage="no"]          inline embed inside a normal
 *                                        page, keeping header + footer
 *    [nepsis_map fullpage="no" height="600px"]
 *
 *  ATTRIBUTES
 *    fullpage   yes | no                          default yes
 *    back       yes | no | a URL or /path         default yes
 *    view       all | levant | galilee | jerusalem | rift | sinai | aegean
 *    era        patriarchs | exodus | judges | united | divided | exile |
 *               intertest | gospels | acts | all
 *    site       a site id, e.g. capernaum, jerusalem, mount-sinai
 *    basemap    satellite | relief | topo | parchment
 *    exag       0 to 6
 *    app        which study to load: holy-land (default) | ministry |
 *               jerusalem | temple. view/era/site/basemap/exag apply to
 *               the holy-land map only and are ignored by the others.
 *    height     inline mode only                  default 78vh
 *    minheight  inline mode only                  default 480px
 *    caption    inline mode only, yes | no        default yes
 *    fullwidth  inline mode only, yes | no        default no
 *    class      extra CSS class on the wrapper
 *    path       override where the map files live (folder or full URL)
 *
 *  `[holy_land_map]` still works as an alias.
 *
 *  For developers: filter `nepsis_map_root` to serve the map from
 *  anywhere, and `nepsis_map_use_wp_head` (return false) for a
 *  completely bare full-page document with no theme assets at all.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'NEPSIS_MAP_VERSION', '2.3.0' );
define( 'NEPSIS_MAP_FILE', __FILE__ );

/** Fallback used when the map folder is not bundled inside the plugin. */
define( 'NEPSIS_MAP_FALLBACK_PATH', '/nepsis-map/' );

/** Shortcode tags this plugin answers to. */
function nepsis_map_tags() {
	return array( 'nepsis_map', 'holy_land_map' );
}

/**
 * Base URL of the map files, always ending in a slash.
 *
 * @return string
 */
function nepsis_map_root() {
	static $root = null;

	if ( null === $root ) {
		if ( file_exists( plugin_dir_path( __FILE__ ) . 'map/index.html' ) ) {
			$root = plugin_dir_url( __FILE__ ) . 'map/';
		} else {
			$root = NEPSIS_MAP_FALLBACK_PATH;
		}
	}

	return apply_filters( 'nepsis_map_root', $root );
}

function nepsis_map_is_bundled() {
	return file_exists( plugin_dir_path( __FILE__ ) . 'map/index.html' );
}


/* ==================================================================
 *  Attribute handling
 * ================================================================== */

function nepsis_map_defaults() {
	return array(
		'fullpage'  => 'yes',
		'app'       => 'holy-land',
		'back'      => 'yes',
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
	);
}

function nepsis_map_is_yes( $v ) {
	return in_array( strtolower( (string) $v ), array( 'yes', 'true', '1', 'on' ), true );
}

function nepsis_map_is_no( $v ) {
	return in_array( strtolower( (string) $v ), array( 'no', 'false', '0', 'off' ), true );
}

/**
 * Build the iframe URL from validated attributes.
 *
 * Every value that reaches the URL is whitelisted, so a typo in the
 * shortcode can never inject anything into the page.
 *
 * @param  array $a       Attributes.
 * @param  bool  $fullpage Whether this is the full-page takeover.
 * @return string
 */
function nepsis_map_build_src( $a, $fullpage ) {

	$views    = array( 'all', 'levant', 'galilee', 'jerusalem', 'rift', 'sinai', 'aegean' );
	$eras     = array(
		'patriarchs', 'exodus', 'judges', 'united', 'divided',
		'exile', 'intertest', 'gospels', 'acts', 'all',
	);
	$basemaps = array( 'satellite', 'relief', 'topo', 'parchment' );

	$query = array(
		'v' => NEPSIS_MAP_VERSION,
		// Binds the back arrow to this site, whatever domain it runs on.
		// The map will not navigate anywhere outside this origin.
		'home' => home_url( '/' ),
	);

	// Full page: the host document does not scroll, so leave the wheel
	// alone and let the map zoom normally. Inline: cooperative gestures.
	$query['embed'] = $fullpage ? '0' : '1';

	// Back arrow.
	if ( ! nepsis_map_is_no( $a['back'] ) ) {
		$raw = trim( (string) $a['back'] );
		if ( nepsis_map_is_yes( $raw ) || '' === $raw ) {
			$query['back'] = '1';
		} elseif ( preg_match( '#^(/[^/]|https?://)#i', $raw ) ) {
			$query['back'] = esc_url_raw( $raw );
		} else {
			$query['back'] = '1';
		}
	}

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

	if ( '' === $a['path'] ) {
		$root = nepsis_map_root();
	} elseif ( preg_match( '#^https?://#i', $a['path'] ) ) {
		$root = trailingslashit( esc_url_raw( $a['path'] ) );
	} else {
		$root = '/' . trim( $a['path'], '/' ) . '/';
	}

	// Which of the four studies to serve. The map sits at the site root;
	// the others live in apps/<id>/. Anything unrecognised falls back to
	// the map, so a typo can never point the iframe off the site.
	$apps = array(
		'holy-land' => '',
		'ministry'  => 'apps/ministry/',
		'jerusalem' => 'apps/jerusalem/',
		'temple'    => 'apps/temple/',
	);
	$app_key = isset( $apps[ $a['app'] ] ) ? $a['app'] : 'holy-land';
	$root   .= $apps[ $app_key ];

	// The map reads all of these; the other three ignore what they do not
	// use but share home/back/embed, so cross-app navigation and the back
	// arrow behave identically everywhere.
	return $root . 'index.html?' . http_build_query( $query );
}


/* ==================================================================
 *  Full-page takeover
 * ================================================================== */

/**
 * Find the map shortcode in a post and return its attributes.
 *
 * @param  WP_Post|null $post Post object.
 * @return array|null Attributes, or null when the shortcode is absent.
 */
function nepsis_map_post_atts( $post ) {
	if ( ! $post || empty( $post->post_content ) ) {
		return null;
	}

	$content = $post->post_content;

	$found = false;
	foreach ( nepsis_map_tags() as $tag ) {
		if ( has_shortcode( $content, $tag ) ) {
			$found = true;
			break;
		}
	}
	if ( ! $found ) {
		return null;
	}

	$pattern = get_shortcode_regex( nepsis_map_tags() );
	if ( ! preg_match( '/' . $pattern . '/s', $content, $m ) ) {
		return null;
	}

	$atts = shortcode_parse_atts( $m[3] );
	if ( ! is_array( $atts ) ) {
		$atts = array();
	}

	return shortcode_atts( nepsis_map_defaults(), $atts, 'nepsis_map' );
}

/**
 * Should the current request be taken over completely?
 *
 * @return array|false The attributes when yes, false when no.
 */
function nepsis_map_takeover_atts() {
	static $cache = null;

	if ( null !== $cache ) {
		return $cache;
	}
	$cache = false;

	if ( is_admin() || ! is_singular() || is_embed() || is_feed() ) {
		return $cache;
	}
	if ( post_password_required() ) {
		return $cache;
	}

	$atts = nepsis_map_post_atts( get_post() );
	if ( null === $atts ) {
		return $cache;
	}
	if ( nepsis_map_is_no( $atts['fullpage'] ) ) {
		return $cache;
	}

	/**
	 * Last word on whether to take the page over.
	 * add_filter( 'nepsis_map_do_takeover', '__return_false' );
	 */
	if ( ! apply_filters( 'nepsis_map_do_takeover', true, $atts ) ) {
		return $cache;
	}

	$cache = $atts;
	return $cache;
}

/**
 * Swap the theme's template for our own full-screen one.
 *
 * This is the whole trick. Rather than fighting the theme with CSS, the
 * theme's page template is never loaded, so there is no header, footer,
 * sidebar or wrapper markup to override.
 */
function nepsis_map_template_include( $template ) {
	$atts = nepsis_map_takeover_atts();
	if ( false === $atts ) {
		return $template;
	}

	$own = plugin_dir_path( __FILE__ ) . 'templates/fullscreen.php';
	return file_exists( $own ) ? $own : $template;
}
add_filter( 'template_include', 'nepsis_map_template_include', 99 );

/** No admin bar on a takeover page - it would push the layout down 32px. */
add_filter(
	'show_admin_bar',
	function ( $show ) {
		return ( false === nepsis_map_takeover_atts() ) ? $show : false;
	}
);

/** Body class, in case anyone wants to hook styling onto it. */
add_filter(
	'body_class',
	function ( $classes ) {
		if ( false !== nepsis_map_takeover_atts() ) {
			$classes[] = 'nepsis-map-fullscreen';
		}
		return $classes;
	}
);


/* ==================================================================
 *  Shortcode (inline mode, and a graceful no-op on takeover pages)
 * ================================================================== */

function nepsis_map_shortcode( $atts = array() ) {

	$a = shortcode_atts( nepsis_map_defaults(), $atts, 'nepsis_map' );

	// On a takeover page the template already rendered the map, so the
	// shortcode inside the_content must not render a second copy.
	if ( false !== nepsis_map_takeover_atts() && ! nepsis_map_is_no( $a['fullpage'] ) ) {
		return '';
	}

	$src = nepsis_map_build_src( $a, false );

	$height    = preg_match( '/^[0-9.]+(px|vh|rem|em|%)$/', $a['height'] ) ? $a['height'] : '78vh';
	$minheight = preg_match( '/^[0-9.]+(px|vh|rem|em|%)$/', $a['minheight'] ) ? $a['minheight'] : '480px';

	$classes = 'nepsis-map-embed';
	if ( nepsis_map_is_yes( $a['fullwidth'] ) ) {
		$classes .= ' nepsis-map-fullwidth';
	}
	if ( $a['class'] ) {
		$classes .= ' ' . sanitize_html_class( $a['class'] );
	}

	$style = sprintf( 'height:%s;min-height:%s;', esc_attr( $height ), esc_attr( $minheight ) );

	ob_start();
	?>
	<div class="<?php echo esc_attr( $classes ); ?>" style="<?php echo esc_attr( $style ); ?>">
		<iframe
			src="<?php echo esc_url( $src ); ?>"
			title="<?php esc_attr_e( 'Nepsis Ministries — interactive 3D map of the Holy Land', 'nepsis-map' ); ?>"
			loading="lazy"
			allowfullscreen
			allow="fullscreen"></iframe>
	</div>
	<?php if ( ! nepsis_map_is_no( $a['caption'] ) ) : ?>
		<p class="nepsis-map-caption">
			<?php esc_html_e( 'Drag to pan · Ctrl (or ⌘) + scroll to zoom · right-drag to tilt and rotate.', 'nepsis-map' ); ?>
			<a href="<?php echo esc_url( nepsis_map_root() ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Open full-screen ↗', 'nepsis-map' ); ?></a>
		</p>
	<?php endif; ?>
	<?php
	return ob_get_clean();
}

foreach ( nepsis_map_tags() as $nepsis_tag ) {
	add_shortcode( $nepsis_tag, 'nepsis_map_shortcode' );
}
unset( $nepsis_tag );

/** Inline-mode styles only. The full-page template carries its own. */
function nepsis_map_styles() {
	if ( false !== nepsis_map_takeover_atts() ) {
		return;
	}
	wp_register_style( 'nepsis-map', false, array(), NEPSIS_MAP_VERSION );
	wp_enqueue_style( 'nepsis-map' );
	wp_add_inline_style(
		'nepsis-map',
		'.nepsis-map-embed{position:relative;width:100%;max-height:900px;margin:0 0 .75rem;' .
		'border-radius:12px;overflow:hidden;background:#0b1017;box-shadow:0 6px 28px rgba(0,0,0,.22)}' .
		'.nepsis-map-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}' .
		'.nepsis-map-caption{font-size:.85rem;opacity:.75;line-height:1.5;margin-top:0}' .
		'.nepsis-map-fullwidth{width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);' .
		'margin-right:calc(50% - 50vw);border-radius:0}' .
		'@media(max-width:782px){.nepsis-map-embed{border-radius:8px}}'
	);
}
add_action( 'wp_enqueue_scripts', 'nepsis_map_styles' );


/* ==================================================================
 *  Breadcrumb
 * ==================================================================
 *  The map's back arrow must return people to the last page they were
 *  on *this site* - never to Google, and never to a blank history.
 *
 *  document.referrer covers most of it, but it is empty on a reload, on
 *  a bookmarked visit, and under some privacy settings. So every other
 *  page on the site records itself in sessionStorage, and the map reads
 *  that. It is one sessionStorage write per page view: nothing is sent
 *  anywhere, nothing is stored between sessions, and it is invisible to
 *  page caching because it runs in the browser.
 */
function nepsis_map_breadcrumb() {
	// Not on the map page itself - that would overwrite the trail.
	if ( false !== nepsis_map_takeover_atts() ) {
		return;
	}
	if ( is_admin() || is_feed() || is_embed() ) {
		return;
	}

	wp_register_script( 'nepsis-map-breadcrumb', false, array(), NEPSIS_MAP_VERSION, true );
	wp_enqueue_script( 'nepsis-map-breadcrumb' );
	wp_add_inline_script(
		'nepsis-map-breadcrumb',
		'try{window.sessionStorage.setItem(' . wp_json_encode( 'nepsis:lastPage' ) .
		',window.location.href);}catch(e){}'
	);
}
add_action( 'wp_enqueue_scripts', 'nepsis_map_breadcrumb' );


/* ==================================================================
 *  Admin niceties
 * ================================================================== */

add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( $links ) {
		array_unshift(
			$links,
			'<a href="' . esc_url( nepsis_map_root() ) . '" target="_blank" rel="noopener">' .
			esc_html__( 'Open map', 'nepsis-map' ) . '</a>'
		);
		return $links;
	}
);

/** Warn if the map files are missing, rather than rendering an empty box. */
add_action(
	'admin_notices',
	function () {
		if ( nepsis_map_is_bundled() || ! current_user_can( 'activate_plugins' ) ) {
			return;
		}
		$screen = get_current_screen();
		if ( ! $screen || 'plugins' !== $screen->id ) {
			return;
		}
		echo '<div class="notice notice-info"><p><strong>Nepsis Ministries Holy Land Map:</strong> ';
		printf(
			/* translators: %s: expected folder path */
			esc_html__( 'no bundled map found, so it will be loaded from %s instead. Upload the map folder there, or reinstall using the packaged ZIP.', 'nepsis-map' ),
			'<code>' . esc_html( NEPSIS_MAP_FALLBACK_PATH ) . '</code>'
		);
		echo '</p></div>';
	}
);

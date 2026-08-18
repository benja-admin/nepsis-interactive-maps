<?php
/**
 * Full-screen map template.
 *
 * Loaded instead of the theme's page template, so the theme's header,
 * footer, sidebars and wrappers never run. This is why the takeover works
 * on any theme: there is nothing to override.
 *
 * @package nepsis-map
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$nepsis_atts = nepsis_map_takeover_atts();
if ( false === $nepsis_atts ) {
	$nepsis_atts = nepsis_map_defaults();   // defensive; should not happen
}

$nepsis_src = nepsis_map_build_src( $nepsis_atts, true );

/**
 * Whether to run wp_head()/wp_footer() on the takeover page.
 *
 * Default true, so analytics, SEO tags and other plugins keep working.
 * Return false for a completely bare document with no theme assets:
 *   add_filter( 'nepsis_map_use_wp_head', '__return_false' );
 */
$nepsis_use_head = (bool) apply_filters( 'nepsis_map_use_wp_head', true );

?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="color-scheme" content="dark">
<title><?php echo esc_html( wp_get_document_title() ); ?></title>
<?php
if ( $nepsis_use_head ) {
	wp_head();
}
?>
<style id="nepsis-map-fullscreen-css">
/* ------------------------------------------------------------------
   Printed AFTER wp_head() so it beats any theme CSS that slipped in.
   The map owns the viewport: no scrolling, no margins, no gaps.
   ------------------------------------------------------------------ */
html.nepsis-map-html,
html.nepsis-map-html body.nepsis-map-body{
	margin:0 !important;
	padding:0 !important;
	width:100% !important;
	height:100% !important;
	min-height:100% !important;
	max-width:none !important;
	overflow:hidden !important;
	background:#0b1017 !important;
	overscroll-behavior:none;
}
/* Themes love to reserve space for a fixed admin bar. We hide the bar. */
html.nepsis-map-html{margin-top:0 !important}
html.nepsis-map-html #wpadminbar{display:none !important}

body.nepsis-map-body > *:not(#nepsis-map-stage):not(script):not(style):not(noscript){
	display:none !important;
}

#nepsis-map-stage{
	position:fixed;
	inset:0;
	width:100vw;
	height:100vh;
	height:100dvh;          /* mobile browser chrome-aware, ignored elsewhere */
	border:0;
	margin:0;
	padding:0;
	z-index:2147483000;
	background:#0b1017;
}
#nepsis-map-stage iframe{
	display:block;
	width:100%;
	height:100%;
	border:0;
	margin:0;
}
#nepsis-map-noscript{
	position:absolute;inset:0;display:grid;place-items:center;padding:2rem;
	color:#e8edf4;font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
	text-align:center;
}
</style>
</head>
<body <?php body_class( 'nepsis-map-body' ); ?>>

<div id="nepsis-map-stage">
	<iframe
		id="nepsis-map-frame"
		src="<?php echo esc_url( $nepsis_src ); ?>"
		title="<?php esc_attr_e( 'Nepsis Ministries — interactive 3D map of the Holy Land', 'nepsis-map' ); ?>"
		allowfullscreen
		allow="fullscreen"
		referrerpolicy="no-referrer-when-downgrade"></iframe>

	<noscript>
		<div id="nepsis-map-noscript">
			<p>This map needs JavaScript.<br>
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>" style="color:#ffd977">Return to the site</a></p>
		</div>
	</noscript>
</div>

<script>
(function () {
	'use strict';

	document.documentElement.className += ' nepsis-map-html';

	var HOME = <?php echo wp_json_encode( home_url( '/' ) ); ?>;
	var CRUMB = <?php echo wp_json_encode( 'nepsis:lastPage' ); ?>;

	function siteOrigin() {
		try { return new URL(HOME, window.location.href).origin; }
		catch (e) { return window.location.origin; }
	}

	/* Only ever hand back a URL that stays on this site. */
	function onSite(u) {
		if (!u) { return null; }
		var parsed;
		try { parsed = new URL(u, window.location.href); } catch (e) { return null; }
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') { return null; }
		if (parsed.origin !== siteOrigin() && parsed.origin !== window.location.origin) { return null; }
		if (parsed.href.split('#')[0] === window.location.href.split('#')[0]) { return null; }
		return parsed.href;
	}

	/* The last page on this site the visitor was looking at: the
	   breadcrumb first (survives a missing referrer), then the referrer. */
	function lastInternalPage() {
		var stored = null;
		try { stored = window.sessionStorage.getItem(CRUMB); } catch (e) {}
		return onSite(stored) || onSite(document.referrer);
	}

	/* The map's back arrow lives inside the iframe. Calling history.back()
	   from a frame is not dependable, so the map asks us to do it and we
	   act on the real top-level history here - never leaving the site. */
	window.addEventListener('message', function (e) {
		if (e.origin !== siteOrigin() && e.origin !== window.location.origin) { return; }
		var d = e.data;
		if (!d || d.source !== 'nepsis-map' || d.action !== 'back') { return; }

		// Came from one of our own pages: a real "back" restores their
		// scroll position, so prefer it.
		if (onSite(document.referrer) && window.history.length > 1) {
			window.history.back();
			return;
		}

		// Arrived from outside (search result, shared link) - stepping back
		// would take them off the site, so go to the last page we know of.
		window.location.href = lastInternalPage() || HOME;
	}, false);

	/* Older iOS Safari ignores 100dvh; keep the stage pinned to the real
	   visible height so the map never sits under the browser chrome. */
	function fit() {
		var el = document.getElementById('nepsis-map-stage');
		if (!el) { return; }
		if (window.CSS && CSS.supports && CSS.supports('height', '100dvh')) { return; }
		el.style.height = window.innerHeight + 'px';
	}
	fit();
	window.addEventListener('resize', fit, { passive: true });
	window.addEventListener('orientationchange', fit, { passive: true });
})();
</script>

<?php
if ( $nepsis_use_head ) {
	wp_footer();
}
?>
</body>
</html>

// Touch keyboard keys for mobile/touch devices (iOS, tablets, etc.)
// Provides on-screen ESC/←/Y/N/→/D/? buttons that mirror keyboard controls

$(function() {
	// Detect touch device and add class to body
	if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
		document.body.classList.add('touch-device');
	}

	// ESC key — close dashboard or reset experience
	$('#key-esc').on('click', function() {
		if (typeof dashboardState !== 'undefined' && dashboardState.visible) {
			toggleDashboard();
		} else {
			resetAlize();
		}
	});

	// ← arrow — cycle dashboard filter left
	$('#key-left').on('click', function() {
		if (typeof dashboardState !== 'undefined' && dashboardState.visible) {
			cycleDashboardFilter(-1);
		}
	});

	// Y key — same as pressing 'y' on keyboard
	$('#key-y').on('click', function() {
		handleYes();
	});

	// N key — same as pressing 'n' on keyboard
	$('#key-n').on('click', function() {
		handleNo();
	});

	// → arrow — cycle dashboard filter right
	$('#key-right').on('click', function() {
		if (typeof dashboardState !== 'undefined' && dashboardState.visible) {
			cycleDashboardFilter(1);
		}
	});

	// D key — toggle dashboard (only when not waiting for Y/N)
	$('#key-d').on('click', function() {
		if (!listeningForAnswer) {
			toggleDashboard();
		}
	});

	// ? key — toggle about window
	$('#key-help').on('click', function() {
		$('#about').toggle();
	});
});

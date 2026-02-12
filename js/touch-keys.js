// Touch keyboard keys for mobile/touch devices (iOS, tablets, etc.)
// Provides on-screen Y/N/D/? buttons that mirror keyboard controls

$(function() {
	// Detect touch device and add class to body
	if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
		document.body.classList.add('touch-device');
	}

	// Y key — same as pressing 'y' on keyboard
	$('#key-y').on('click', function() {
		handleYes();
	});

	// N key — same as pressing 'n' on keyboard
	$('#key-n').on('click', function() {
		handleNo();
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

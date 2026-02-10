var isPowerOn = true;
var isTransitioning = false;

function togglePower() {
	if (isTransitioning) return;
	isTransitioning = true;

	var pvm = document.getElementById('pvm');
	var body = document.body;

	if (isPowerOn) {
		pvm.classList.add('power-off-anim');
		setTimeout(function() {
			isPowerOn = false;
			body.classList.remove('power-on');
			pvm.classList.remove('power-off-anim');
			pvm.classList.add('off-hidden');
			isTransitioning = false;
		}, 300);
	} else {
		isPowerOn = true;
		pvm.classList.remove('off-hidden');
		pvm.classList.add('power-on-anim');
		body.classList.add('power-on');

		setTimeout(function() {
			pvm.classList.remove('power-on-anim');
			triggerDegauss();
			isTransitioning = false;
		}, 300);
	}
}

function triggerDegauss() {
	if (!isPowerOn || isTransitioning) return;
	var pvm = document.getElementById('pvm');
	pvm.classList.add('degaussing');
	setTimeout(function() {
		pvm.classList.remove('degaussing');
	}, 400);
}

$(function() {
	$('#btn-menu').on('click', function() {
		toggleDashboard();
	});
	$('#btn-about').on('click', function() {
		$('#about').toggle();
	});
	$('#btn-degauss').on('click', function() {
		triggerDegauss();
	});
	$('#btn-power').on('click', function() {
		togglePower();
	});
});

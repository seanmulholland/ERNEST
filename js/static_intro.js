var camera, scene, renderer;
var videoTexture,videoMaterial;
var composer;
var shaderTime = 0;
var badTVParams, badTVPass;
var staticParams, staticPass;
var rgbParams, rgbPass;
var filmParams, filmPass;
var renderPass, copyPass;
var pnoise, globalParams;

var totalFaceCount = 0;
var faceRecognized = 0;

function initStatic() {

	camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 20, 3000);
	camera.position.z = 1000;
	scene = new THREE.Scene();

	//init video texture
	videoTexture = new THREE.Texture( video );
	videoTexture.minFilter = THREE.LinearFilter;
	videoTexture.magFilter = THREE.LinearFilter;

	videoMaterial = new THREE.MeshBasicMaterial( {
		map: videoTexture
	} );
	videoMaterial.side = THREE.DoubleSide; // make material double sided


	//Add video plane
	var planeGeometry = new THREE.PlaneGeometry( 800, 600,1,1 );
	var plane = new THREE.Mesh( planeGeometry, videoMaterial );
	scene.add( plane );
	plane.z = 0;
	plane.scale.x = -1.45; // flip material for proper mirror effect
	plane.scale.y = 1.45;

	//init renderer
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.domElement.style.position = 'fixed';
	renderer.domElement.style.top = '0';
	renderer.domElement.style.left = '0';
	renderer.domElement.style.zIndex = '1';
	document.body.appendChild( renderer.domElement );
	console.log('Renderer initialized and added to DOM');

	//POST PROCESSING
	//Create Shader Passes
	renderPass = new THREE.RenderPass( scene, camera );
	badTVPass = new THREE.ShaderPass( THREE.BadTVShader );
	rgbPass = new THREE.ShaderPass( THREE.RGBShiftShader );
	filmPass = new THREE.ShaderPass( THREE.FilmShader );
	staticPass = new THREE.ShaderPass( THREE.StaticShader );
	copyPass = new THREE.ShaderPass( THREE.CopyShader );

	//set shader uniforms
	filmPass.uniforms.grayscale.value = 0;


	onToggleShaders();

	initParams();
	// Apply initial params based on starting faceDistance (faceLow = max shader effects)
	updateParams();

	window.addEventListener('resize', onResize, false);
	onResize();
	
	// Update overlay size after a short delay to ensure video is ready
	setTimeout(updateOverlaySize, 100);

}


function initParams() {
	badTVPass.uniforms[ 'distortion' ].value = 3;
	badTVPass.uniforms[ 'distortion2' ].value = 4;
	badTVPass.uniforms[ 'speed' ].value = 0.3;
	badTVPass.uniforms[ 'rollSpeed' ].value = 0.1;
	rgbPass.uniforms[ 'angle' ].value = 1;
	rgbPass.uniforms[ 'amount' ].value = 0.05;
	staticPass.uniforms[ 'amount' ].value = 0.05;
	filmPass.uniforms[ 'sCount' ].value = 679;
	filmPass.uniforms[ 'sIntensity' ].value = 0.5;
	filmPass.uniforms[ 'nIntensity' ].value = 0.3;
}

function updateParams() {
	badTVPass.uniforms[ 'distortion' ].value = map_range(faceDistance,faceLow,faceHigh,3.0, 1.0);
	badTVPass.uniforms[ 'distortion2' ].value = map_range(faceDistance,faceLow,faceHigh,4.0, 1.2);
	badTVPass.uniforms[ 'speed' ].value = map_range(faceDistance,faceLow,faceHigh,0.3, 0.0);
	badTVPass.uniforms[ 'rollSpeed' ].value = map_range(faceDistance,faceLow,faceHigh,0.1, 0.0);
	rgbPass.uniforms[ 'amount' ].value = map_range(faceDistance,faceLow,faceHigh,0.05, 0.01);
	// staticPass.uniforms[ 'amount' ].value = map_range(faceDistance,faceLow,faceHigh,0.07, 0.03);
	// filmPass.uniforms[ 'sCount' ].value = map_range(faceDistance,faceLow,faceHigh,679.0, 0.0);
	filmPass.uniforms[ 'sIntensity' ].value = map_range(faceDistance,faceLow,faceHigh,0.5, 0.01);
	filmPass.uniforms[ 'nIntensity' ].value = map_range(faceDistance,faceLow,faceHigh,0.3, 0.0);
}


function onToggleShaders(){

	//Add Shader Passes to Composer
	//order is important
	composer = new THREE.EffectComposer( renderer);
	composer.addPass( renderPass );

	composer.addPass( filmPass );
	composer.addPass( badTVPass );
	composer.addPass( rgbPass );
	composer.addPass( staticPass );

	composer.addPass( copyPass );
	copyPass.renderToScreen = true;
}

function animateStatic() {

	// Update params based on faceDistance (only when not in face detection processing)
	if (!faceDetectionIsCurrent) {
		updateParams();
	}

	shaderTime += 0.1;
	badTVPass.uniforms[ 'time' ].value =  shaderTime;
	filmPass.uniforms[ 'time' ].value =  shaderTime;
	staticPass.uniforms[ 'time' ].value =  shaderTime;

	if ( video && video.readyState === video.HAVE_ENOUGH_DATA ) {
		if ( videoTexture ) videoTexture.needsUpdate = true;
	}

	if (composer) {
		composer.render( 0.1);
	}

	if (faceDetectionIsCurrent) {
		faceDetectionProcessing();
	} else if (faceDistance >= faceHigh) {
		faceDetectionIsCurrent = true;
		$( '#overlay' ).fadeIn(1000); // show overlay to indicate to user face is being recognized
		faceTimestamp = new Date();
	}

}

function faceDetectionProcessing() {
	var currentTime = new Date();
	if (currentTime - faceTimestamp >= 2000) {
		if (faceRecognized >= totalFaceCount * 2/3) {
			experienceBegin = true;
			// For some reason this is adding in a momentary glitch of the overlay popping out
			// It has something to do with the overlay fading out multiple times I beleive
			$( "canvas" ).each(function(){
				if(this.id != 'overlay') {
					$(this).fadeOut(2345);
				}
				//  else {
				// 	$(this).fadeOut(7777);
				// }
			});
				$( '#facebox' ).hide();
		} else {
			$( '#overlay' ).hide();
			faceDetectionIsCurrent = false;
			console.log('mm')
		}
		resetFaceRecog();
	} else if (faceDistance - faceHigh >= -0.1) {
		faceRecognized++;
	}
	totalFaceCount++;
}

function resetFaceRecog() {
	totalFaceCount = 0;
	faceRecognized = 0;
}

function onResize() {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	// Update overlay size to match video display area
	updateOverlaySize();
}

function updateOverlaySize() {
	if (!overlay) return;
	// The video plane geometry is 800x600, scaled by 1.45
	// The overlay canvas is 320x240 internally (for clmtrackr), displayed via CSS
	// We need to match the visual size of the video as displayed in Three.js
	// Since the plane is 800x600 scaled 1.45x, the visual size is 1160x870
	// But we need to account for how it appears on screen with the current camera setup
	
	// The plane's aspect ratio is 800/600 = 1.333
	var planeAspect = 800 / 600;
	var scaledWidth = 800 * 1.45; // 1160
	var scaledHeight = 600 * 1.45; // 870
	
	// Calculate the actual screen size of the plane based on camera FOV
	// With FOV 55 and distance 1000, we can estimate the visible size
	// But simpler: match the plane's scaled dimensions proportionally to viewport
	var viewportAspect = window.innerWidth / window.innerHeight;
	
	var overlayWidth, overlayHeight;
	
	// Try to match the plane's visual size on screen
	// Since camera is at z=1000 and plane is at z=0, the plane appears at 1:1 scale roughly
	// So 1160x870 should be close to actual pixels, but we need to fit to viewport
	if (viewportAspect > planeAspect) {
		// Viewport is wider - fit to height
		overlayHeight = scaledHeight;
		overlayWidth = overlayHeight * planeAspect;
	} else {
		// Viewport is taller - fit to width
		overlayWidth = scaledWidth;
		overlayHeight = overlayWidth / planeAspect;
	}
	
	// Scale to fit viewport if needed (max 90% of viewport)
	var maxWidth = window.innerWidth * 0.9;
	var maxHeight = window.innerHeight * 0.9;
	if (overlayWidth > maxWidth) {
		overlayWidth = maxWidth;
		overlayHeight = overlayWidth / planeAspect;
	}
	if (overlayHeight > maxHeight) {
		overlayHeight = maxHeight;
		overlayWidth = overlayHeight * planeAspect;
	}
	
	// Update CSS size (internal canvas size stays 320x240 for clmtrackr)
	overlay.style.width = overlayWidth + 'px';
	overlay.style.height = overlayHeight + 'px';
}

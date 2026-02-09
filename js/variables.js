var video
var overlay;
var overlayCC;

var foundFace = false;
var faceDistance = 1.1; // Start at faceLow for maximum shader effects
var faceLow = 1.1;
var faceHigh = 1.5;
var faceDetectionIsCurrent = false;
var faceTimestamp;

var experienceBegin = false;

var maxEmotion = {
	emotion: 'unsure',
	value: 0
}
var emotions = {
	anger: 0,
	disgust: 0,
	fear: 0,
	sad: 0,
	surprise: 0,
	happy: 0
};
var totalEmotionsRead = 0;

var smileTimeout;

var listeningForAnswer = false;

var currentQuestion = 0;
var questionAnswered = true;

var guessCorrect;
var maxEmotionVal;

var typingTimeout;
var blockInterval;

var dontLook;
var dontLookTimeout;


function initVariables() {
  // Face contour overlay
	overlay = document.getElementById('overlay');
	overlayCC = overlay.getContext('2d');
	$( '#overlay' ).hide();
	$( '#analytics' ).hide();
	$( '#gif' ).hide();
	$( '#reportCard' ).hide();
	$( '#about' ).hide();
	gifSrc();
	createVideo();
}

function activateStaticCanvas() {
	$( "canvas" ).each(function(){
		if(!this.id) {
			$(this).fadeIn(3000);
		}
	})
}

// Reset all flags here
// TODO: this reset should prolly have some window of time until face search restarts (setTimeout around some variable reset, gotta think more to decide)
function resetAlize() {
	clearTimeout(typingTimeout);
	clearInterval(blockInterval);
	foundFace = false;
	faceDistance = faceLow;
	faceDetectionIsCurrent = false;
	experienceBegin = false;
	currentQuestion = 0;
	questionAnswered = true;
	listeningForAnswer = false;
	dontLook = true;
	dontLookTimeout = setTimeout(function(){
		dontLook = false;
	}, 2000);
	smileValue = 0.0;
	emotions = {
		anger: 0,
		disgust: 0,
		fear: 0,
		sad: 0,
		surprise: 0,
		happy: 0
	};
	totalEmotionsRead = 0;
	$('#text-container').empty();
	$('#text-container').css({
		top: 0
	});
	$( '#overlay' ).hide();
	$( '#analytics' ).hide();
	$( '#gif' ).hide();
	$( '#reportCard' ).hide();
	// $( '#about' ).hide();
	$( '#facebox' ).show();
	gifSrc();
	activateStaticCanvas();
}

document.onkeydown = function(evt) {
    evt = evt || window.event;
    var isEscape = false;
    var isSlash = false;

    if ("key" in evt) {
        isEscape = (evt.key == "Escape" || evt.key == "Esc");
    } else {
        isEscape = (evt.keyCode == 27);
    }
    if (isEscape) {
        resetAlize();
    }

    if ("key" in evt) {
        isSlash = (evt.key == "/" || evt.key == "?");
    } else {
        isSlash = (evt.keyCode == 191);
    }
    if (isSlash) {
		$( '#about' ).toggle();
    }
};

//  GIF Randomizer
function gifSrc() {
  var img = document.getElementsByClassName('gifSrc');
  console.log(img);

  // Set fallback first to prevent undefined errors
  var fallbackUrl = 'https://media.giphy.com/media/100QWMdxQJzQC4/giphy.gif';
  for (var i = 0; i < img.length; i++) {
    if (!img[i].src || img[i].src === 'undefined' || img[i].src.indexOf('undefined') !== -1) {
      img[i].src = fallbackUrl;
    }
  }

  // Giphy tag query
  var q = "baby animal";

  // Giphy API call
  $.get('https://api.giphy.com/v1/gifs/random?api_key=d4eZba5M86PHdo7wJuURZ3yCB3WHEEvF&tag=' + q )
    .done(function(response) {
      var imageUrl = null;
      if (response && response.data) {
        if (response.data.image_url) {
          imageUrl = response.data.image_url;
        } else if (response.data.images && response.data.images.original && response.data.images.original.url) {
          imageUrl = response.data.images.original.url;
        }
      }
      
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.length > 0) {
        console.log('gif loaded:', imageUrl);
        for (var i = 0; i < img.length; i++) {
          img[i].src = imageUrl;
        }
      } else {
        console.warn('Giphy API response format unexpected, using fallback');
      }
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
      console.warn('Giphy API call failed:', textStatus, errorThrown);
      // Fallback already set above
    });
}

function createVideo() {
	//Use webcam
	video = document.getElementById('videoel');
	if (!video) {
		console.error('Video element not found');
		return;
	}
	
	video.width = 320;
	video.height = 240;
	video.autoplay = true;
	video.playsInline = true;
	video.muted = true;
	video.volume = 0;
	
	// Modern API first, fallback to legacy
	if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
		// Modern API
		navigator.mediaDevices.getUserMedia({
			video: {
				width: 320,
				height: 240
			}
		})
		.then(function(stream) {
			video.srcObject = stream;
			console.log('Webcam access granted');
			// Wait for video to start playing before starting tracking
			video.addEventListener('playing', function() {
				console.log('Video is playing, starting face tracking');
				if (typeof startTracking === 'function') {
					startTracking();
				}
			}, { once: true });
			// Also try playing the video
			video.play().catch(function(err) {
				console.error('Error playing video:', err);
			});
		})
		.catch(function(error) {
			console.error('Error accessing webcam:', error);
			// Try legacy API as fallback
			tryLegacyGetUserMedia();
		});
	} else {
		// Legacy API fallback
		tryLegacyGetUserMedia();
	}
	
	function tryLegacyGetUserMedia() {
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
		if (navigator.getUserMedia) {
			navigator.getUserMedia({
				video: true
			}, function(stream) {
				video.srcObject = stream;
				console.log('Webcam access granted (legacy API)');
				// Wait for video to start playing before starting tracking
				video.addEventListener('playing', function() {
					console.log('Video is playing (legacy), starting face tracking');
					if (typeof startTracking === 'function') {
						startTracking();
					}
				}, { once: true });
				// Also try playing the video
				video.play().catch(function(err) {
					console.error('Error playing video:', err);
				});
			}, function(error) {
				console.error('Unable to capture WebCam:', error);
			});
		} else {
			console.error('getUserMedia not supported in this browser');
		}
	}
};


function getDistance(lat1,lon1,lat2,lon2) {
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return c;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function map_range(value, low1, high1, low2, high2) {
	value = Math.max(low1, Math.min(high1,value));
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

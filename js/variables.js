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

// Content manifest system
var contentManifest = null;
var currentContentId = null;
var sessionShownContent = [];

// Supabase client (reads only — writes go through Edge Function)
var supabaseClient = null;
var SUPABASE_URL = '%%SUPABASE_URL%%';  // Injected at build time by Netlify
var SUPABASE_PUBLISHABLE_KEY = '%%SUPABASE_PUBLISHABLE_KEY%%';  // Injected at build time (read-only publishable key)

function initVariables() {
  // Face contour overlay
	overlay = document.getElementById('overlay');
	overlayCC = overlay.getContext('2d');
	$( '#overlay' ).hide();
	$( '#analytics' ).hide();
	$( '#gif' ).hide();
	$( '#reportCard' ).hide();
	$( '#about' ).hide();
	$( '#dashboard' ).hide();
	loadManifestAndSelectContent();
	initSupabase();
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
	$( '#dashboard' ).hide();
	if (typeof dashboardState !== 'undefined') dashboardState.visible = false;
	// $( '#about' ).hide();
	$( '#facebox' ).show();
	selectContent();
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
        // Close dashboard first if open, otherwise reset
        if (typeof dashboardState !== 'undefined' && dashboardState.visible) {
            toggleDashboard();
        } else {
            resetAlize();
        }
    }

    if ("key" in evt) {
        isSlash = (evt.key == "/" || evt.key == "?");
    } else {
        isSlash = (evt.keyCode == 191);
    }
    if (isSlash) {
		$( '#about' ).toggle();
    }

    // Dashboard toggle — only when not waiting for Y/N input
    if (!listeningForAnswer && (evt.key == 'd' || evt.key == 'D')) {
        toggleDashboard();
    }

    // Dashboard controls — only when dashboard is visible
    if (typeof dashboardState !== 'undefined' && dashboardState.visible) {
        if (evt.key == 'ArrowUp') {
            evt.preventDefault();
            scrollDashboard(-1);
        } else if (evt.key == 'ArrowDown') {
            evt.preventDefault();
            scrollDashboard(1);
        } else if (evt.key == '0') {
            filterDashboard('all');
        } else if (evt.key == '1') {
            filterDashboard('happy');
        } else if (evt.key == '2') {
            filterDashboard('sad');
        } else if (evt.key == '3') {
            filterDashboard('angry');
        } else if (evt.key == '4') {
            filterDashboard('disgusted');
        } else if (evt.key == '5') {
            filterDashboard('fearful');
        } else if (evt.key == '6') {
            filterDashboard('surprised');
        }
    }
};

// Load content manifest and select first content item
function loadManifestAndSelectContent() {
  $.getJSON('content-manifest.json')
    .done(function(manifest) {
      contentManifest = manifest;
      console.log('Content manifest loaded: ' + manifest.items.length + ' items');
      selectContent();
    })
    .fail(function() {
      console.warn('Failed to load content manifest, falling back to Giphy API');
      gifSrcFallback();
    });
}

// Select a random content item from the manifest
function selectContent() {
  if (!contentManifest || contentManifest.items.length === 0) {
    gifSrcFallback();
    return;
  }

  var items = contentManifest.items;

  // Reset shown list if all items have been displayed
  if (sessionShownContent.length >= items.length) {
    sessionShownContent = [];
  }

  // Filter to unshown items
  var available = items.filter(function(item) {
    return sessionShownContent.indexOf(item.id) === -1;
  });

  // Pick random item from available
  var picked = available[Math.floor(Math.random() * available.length)];
  sessionShownContent.push(picked.id);
  currentContentId = picked.id;

  var contentUrl = 'content/' + picked.filename;
  var img = document.getElementsByClassName('gifSrc');
  for (var i = 0; i < img.length; i++) {
    img[i].src = contentUrl;
  }
  console.log('Content selected: ' + picked.id);
}

// Giphy API fallback (used when manifest is empty or unavailable)
function gifSrcFallback() {
  var img = document.getElementsByClassName('gifSrc');

  var fallbackUrl = 'https://media.giphy.com/media/100QWMdxQJzQC4/giphy.gif';
  for (var i = 0; i < img.length; i++) {
    if (!img[i].src || img[i].src === 'undefined' || img[i].src.indexOf('undefined') !== -1) {
      img[i].src = fallbackUrl;
    }
  }

  var q = "baby animal";
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
    });
}

// Initialize Supabase client (read-only — used for rankings and dashboard)
function initSupabase() {
  if (window.supabase && window.supabase.createClient &&
      SUPABASE_URL && SUPABASE_URL.indexOf('%%') === -1 &&
      SUPABASE_PUBLISHABLE_KEY && SUPABASE_PUBLISHABLE_KEY.indexOf('%%') === -1) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    console.log('Supabase client initialized (read-only)');
  } else {
    console.warn('Supabase not configured — scores will not be persisted');
  }
}

// Submit emotion reaction via Edge Function (server-side write)
function submitReaction() {
  if (!currentContentId || !SUPABASE_URL || SUPABASE_URL.indexOf('%%') !== -1) return;

  var sessionId = sessionStorage.getItem('ernest_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('ernest_session_id', sessionId);
  }

  var total = totalEmotionsRead || 1;
  var reactionData = {
    content_id: currentContentId,
    session_id: sessionId,
    happy: emotions.happy / total,
    sad: emotions.sad / total,
    angry: emotions.anger / total,
    disgusted: emotions.disgust / total,
    fearful: emotions.fear / total,
    surprised: emotions.surprise / total,
    dominant_emotion: maxEmotion.emotion
  };

  var edgeFunctionUrl = SUPABASE_URL + '/functions/v1/submit-reaction';

  fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reactionData)
  })
  .then(function(response) {
    if (!response.ok) {
      console.warn('Score submit failed: HTTP ' + response.status);
    } else {
      console.log('Reaction submitted for: ' + currentContentId);
    }
  })
  .catch(function(err) {
    console.warn('Score submit error:', err);
  });
}

// Fetch aggregate ranking for a single content item
function fetchContentRanking(contentId) {
  if (!supabaseClient) return Promise.resolve(null);
  return supabaseClient
    .from('content_rankings')
    .select('*')
    .eq('content_id', contentId)
    .maybeSingle()
    .then(function(result) {
      return result.error ? null : result.data;
    });
}

// Fetch emotion rank position for a content item
function fetchEmotionRank(contentId, emotion) {
  if (!supabaseClient) return Promise.resolve(null);
  return supabaseClient
    .from('content_rankings')
    .select('content_id, avg_' + emotion)
    .order('avg_' + emotion, { ascending: false })
    .then(function(result) {
      if (result.error || !result.data) return null;
      var rank = result.data.findIndex(function(r) {
        return r.content_id === contentId;
      });
      return rank === -1 ? null : rank + 1;
    });
}

// Fetch all content rankings for dashboard
function fetchAllRankings() {
  if (!supabaseClient) return Promise.resolve([]);
  return supabaseClient
    .from('content_rankings')
    .select('*')
    .order('total_reactions', { ascending: false })
    .then(function(result) {
      return result.error ? [] : result.data;
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

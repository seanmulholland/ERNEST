function showAnalytics() {
  $( '#analytics' ).show();
  $( '#collectiveResult' ).hide();

  // Fetch collective ranking for current content
  if (currentContentId && supabase) {
    var emotion = maxEmotion.emotion || 'happy';
    Promise.all([
      fetchEmotionRank(currentContentId, emotion),
      fetchContentRanking(currentContentId)
    ]).then(function(results) {
      var rank = results[0];
      var data = results[1];

      var rankEl = document.getElementById('contentRank');
      var reactionsEl = document.getElementById('totalReactions');

      if (data && rank) {
        rankEl.textContent = 'This image ranks #' + rank + ' for ' + emotion.toUpperCase();
        reactionsEl.textContent = data.total_reactions + ' total reactions';
      } else {
        rankEl.textContent = "You're the first to react to this!";
        reactionsEl.textContent = '';
      }
      $( '#collectiveResult' ).show();
    });
  }

  smileTimeout = setTimeout(function() {
    questionAnswered = true;
  $( '#analytics' ).hide();
  }, 5000); // Wait 5s to determine emotion
}

function takeSnapshot() {
  var video = document.getElementById('videoel')
      , canvas;
  var img = document.getElementById('emo1');
  var context;
  var width = video.offsetWidth
    , height = video.offsetHeight;

  canvas = canvas || document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, width, height);

  img.src = canvas.toDataURL('image/png');
}

function guessUpdate() {
  var guess = document.getElementById('guess');
  var guessResult = document.getElementById('guessResult');

  guess.textContent = maxEmotionVal + "% confidence: " + maxEmotion.emotion;

  if (guessCorrect == true) {
    guessResult.textContent = "> Great, glad to hear my model is working!";
  } else {
    guessResult.textContent = "> Sorry I didn't get it right, I'm still learning :-{";
  }

}

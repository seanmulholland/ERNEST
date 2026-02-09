var dashboardState = {
  visible: false,
  filter: 'all',
  scrollIndex: 0,
  rankings: [],
  manifest: null
};

var DASHBOARD_VISIBLE_ITEMS = 5;
var EMOTION_FILTERS = ['all', 'happy', 'sad', 'angry', 'disgusted', 'fearful', 'surprised'];

function toggleDashboard() {
  dashboardState.visible = !dashboardState.visible;

  if (dashboardState.visible) {
    dashboardState.scrollIndex = 0;
    dashboardState.manifest = contentManifest;
    renderDashboardFilters();

    fetchAllRankings().then(function(rankings) {
      dashboardState.rankings = rankings || [];
      sortAndRenderDashboard();
    });

    $('#dashboard').show();
  } else {
    $('#dashboard').hide();
  }
}

function renderDashboardFilters() {
  var html = '';
  EMOTION_FILTERS.forEach(function(f, i) {
    var activeClass = (f === dashboardState.filter) ? ' active' : '';
    var label = '[' + (i === 0 ? '0' : i) + '] ' + f.toUpperCase();
    html += '<span class="dashboard-filter' + activeClass + '" data-filter="' + f + '">' + label + '</span> ';
  });
  document.getElementById('dashboardFilters').innerHTML = html;
}

function filterDashboard(emotion) {
  dashboardState.filter = emotion;
  dashboardState.scrollIndex = 0;
  renderDashboardFilters();
  sortAndRenderDashboard();
}

function scrollDashboard(direction) {
  var maxIndex = Math.max(0, dashboardState.rankings.length - DASHBOARD_VISIBLE_ITEMS);
  dashboardState.scrollIndex = Math.max(0, Math.min(maxIndex, dashboardState.scrollIndex + direction));
  renderDashboardList();
}

function sortAndRenderDashboard() {
  var rankings = dashboardState.rankings.slice();

  if (dashboardState.filter !== 'all') {
    var key = 'avg_' + dashboardState.filter;
    rankings.sort(function(a, b) {
      return (b[key] || 0) - (a[key] || 0);
    });
  } else {
    rankings.sort(function(a, b) {
      return (b.total_reactions || 0) - (a.total_reactions || 0);
    });
  }

  dashboardState.rankings = rankings;
  renderDashboardList();
}

function renderDashboardList() {
  var rankings = dashboardState.rankings;
  var listEl = document.getElementById('dashboardList');

  if (rankings.length === 0) {
    listEl.innerHTML = '<p style="padding:40px 0;">No reactions yet — be the first!</p>';
    return;
  }

  var start = dashboardState.scrollIndex;
  var end = Math.min(start + DASHBOARD_VISIBLE_ITEMS, rankings.length);
  var html = '';

  for (var i = start; i < end; i++) {
    var item = rankings[i];
    var filename = getFilenameForContentId(item.content_id);
    var thumbSrc = filename ? 'content/' + filename : '';

    html += '<div class="dashboard-item">';
    html += '<span class="dashboard-rank">#' + (i + 1) + '</span>';

    if (thumbSrc) {
      html += '<img src="' + thumbSrc + '" alt="' + item.content_id + '" />';
    }

    html += '<div class="dashboard-item-details">';
    html += '<div class="dashboard-item-name">' + item.content_id + '</div>';

    var emotions = ['happy', 'sad', 'angry', 'disgusted', 'fearful', 'surprised'];
    emotions.forEach(function(emo) {
      var val = item['avg_' + emo] || 0;
      var pct = Math.round(val * 100);
      var highlight = (dashboardState.filter === emo) ? ' highlighted' : '';
      html += '<div class="emotion-bar-container">';
      html += '<span class="emotion-bar-label">' + emo.substring(0, 3).toUpperCase() + '</span>';
      html += '<div class="emotion-bar-track"><div class="emotion-bar' + highlight + '" style="width:' + pct + '%"></div></div>';
      html += '<span class="emotion-bar-value">' + val.toFixed(2) + '</span>';
      html += '</div>';
    });

    html += '<div class="dashboard-item-count">' + (item.total_reactions || 0) + ' reactions</div>';
    html += '</div>';
    html += '</div>';
  }

  // Scroll indicator
  if (rankings.length > DASHBOARD_VISIBLE_ITEMS) {
    html += '<p style="font-size:14px; opacity:0.7;">' + (start + 1) + '-' + end + ' of ' + rankings.length + '</p>';
  }

  listEl.innerHTML = html;
}

function getFilenameForContentId(contentId) {
  if (!dashboardState.manifest || !dashboardState.manifest.items) return null;
  for (var i = 0; i < dashboardState.manifest.items.length; i++) {
    if (dashboardState.manifest.items[i].id === contentId) {
      return dashboardState.manifest.items[i].filename;
    }
  }
  return null;
}

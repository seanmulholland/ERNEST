var dashboardState = {
  visible: false,
  filter: 'happy',
  dataMode: 'weighted',
  scrollIndex: 0,
  rankings: [],
  manifest: null
};

var DASHBOARD_PAGE_SIZE = 6;
var EMOTION_FILTERS = ['happy', 'sad', 'angry', 'disgust', 'fear', 'surprise'];
var DATA_MODES = ['weighted', 'confirmed'];

function toggleDashboard() {
  dashboardState.visible = !dashboardState.visible;

  if (dashboardState.visible) {
    dashboardState.scrollIndex = 0;
    dashboardState.manifest = contentManifest;
    renderDashboardFilters();

    fetchRankingsForMode().then(function(rankings) {
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
    var label = '[' + (i + 1) + '] ' + f.toUpperCase();
    html += '<span class="dashboard-filter' + activeClass + '" data-filter="' + f + '">' + label + '</span> ';
  });
  document.getElementById('dashboardFilters').innerHTML = html;
  var modeLabel = document.getElementById('dashboardModeLabel');
  if (modeLabel) modeLabel.textContent = '[W] ' + dashboardState.dataMode.toUpperCase();
}

function filterDashboard(emotion) {
  dashboardState.filter = emotion;
  dashboardState.scrollIndex = 0;
  renderDashboardFilters();
  sortAndRenderDashboard();
}

function cycleDashboardFilter(direction) {
  var currentIndex = EMOTION_FILTERS.indexOf(dashboardState.filter);
  var nextIndex = (currentIndex + direction + EMOTION_FILTERS.length) % EMOTION_FILTERS.length;
  filterDashboard(EMOTION_FILTERS[nextIndex]);
}

function scrollDashboard(direction) {
  var listEl = document.getElementById('dashboardList');
  listEl.scrollTop += direction * 150;
}

function cycleDashboardDataMode() {
  var currentIndex = DATA_MODES.indexOf(dashboardState.dataMode);
  var nextIndex = (currentIndex + 1) % DATA_MODES.length;
  dashboardState.dataMode = DATA_MODES[nextIndex];
  dashboardState.scrollIndex = 0;
  renderDashboardFilters();
  fetchRankingsForMode().then(function(rankings) {
    dashboardState.rankings = rankings || [];
    sortAndRenderDashboard();
  });
}

function fetchRankingsForMode() {
  if (!supabaseClient) return Promise.resolve([]);
  var viewName;
  if (dashboardState.dataMode === 'weighted') {
    viewName = 'weighted_content_rankings';
  } else if (dashboardState.dataMode === 'confirmed') {
    viewName = 'confirmed_content_rankings';
  } else {
    viewName = 'content_rankings';
  }
  return supabaseClient
    .from(viewName)
    .select('*')
    .order('total_reactions', { ascending: false })
    .then(function(result) {
      return result.error ? [] : result.data;
    });
}

function sortAndRenderDashboard() {
  var rankings = dashboardState.rankings.slice();

  var key = 'avg_' + dashboardState.filter;
  rankings.sort(function(a, b) {
    return (b[key] || 0) - (a[key] || 0);
  });

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

  var start = 0;
  var end = Math.min(rankings.length, 6);
  var html = '<div class="dashboard-grid">';

  for (var i = start; i < end; i++) {
    var item = rankings[i];
    var filename = getFilenameForContentId(item.content_id);
    var thumbSrc = filename ? 'content/' + filename : '';

    html += '<div class="dashboard-card">';
    html += '<div class="dashboard-card-inner">';

    // Thumbnail left side
    html += '<div class="dashboard-card-thumb">';
    if (thumbSrc) {
      html += '<img src="' + thumbSrc + '" alt="' + item.content_id + '" />';
    }
    html += '<span class="dashboard-card-rank">#' + (i + 1) + '</span>';
    html += '</div>';

    // Bars right side
    html += '<div class="dashboard-card-info">';
    html += '<div class="dashboard-card-name">' + item.content_id + '</div>';

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

    html += '<div class="dashboard-card-count">' + (item.total_reactions || 0) + ' reactions</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
  }

  html += '</div>';
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

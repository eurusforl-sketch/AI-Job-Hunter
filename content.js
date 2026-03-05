(function () {
  const MIN_TEXT_LENGTH = 80;
  /** 整页抓取时保留完整 JD，不再截断（单页约 8 万字上限） */
  const FALLBACK_MAX_CHARS = 80000;
  var JD_MATCH_KEYWORDS = [
    '岗位', '职位', '岗位描述', '职位描述', '工作内容', '岗位职责', '任职要求', 'Job', 'Position', 'Responsibilities', 'Requirements'
  ];
  var RECOMMEND_HEADERS = [
    '推荐职位', '相关职位', '相似职位', '该公司其他职位', 'Similar jobs', 'Recommended', 'Related jobs'
  ];

  const SITE_SELECTORS = {
    'www.zhipin.com': {
      jobTitle: ['.job-name', '.job-title', 'h1.name'],
      company: ['.company-name', '.info-company .name'],
      jd: ['.job-detail-section', '.job-detail', '.detail-content', '[class*="job-detail"]']
    },
    'www.lagou.com': {
      jobTitle: ['.position-head .name', '.job-name', 'h1.name'],
      company: ['.company-name', '.company_name'],
      jd: ['.job-detail', '.position-detail', '.job-detail-content', '.content']
    },
    'www.linkedin.com': {
      jobTitle: ['.jobs-unified-top-card__job-title', 'h1'],
      company: ['.jobs-unified-top-card__company-name'],
      jd: ['.jobs-box__html-content', '.jobs-description__content', '[class*="description"]']
    }
  };

  function getHostname() {
    try {
      var h = window.location.hostname;
      if (h === 'zhipin.com' || h === 'www.zhipin.com') return 'www.zhipin.com';
      if (h === 'lagou.com' || h === 'www.lagou.com') return 'www.lagou.com';
      if (h === 'linkedin.com' || h === 'www.linkedin.com') return 'www.linkedin.com';
      return h;
    } catch (_) { return ''; }
  }

  function getVisibleText(el) {
    if (!el) return '';
    try {
      var t = (typeof el.innerText !== 'undefined' ? el.innerText : el.textContent) || '';
      return (t + '').trim();
    } catch (_) { return ''; }
  }

  function getRawPageText(maxChars) {
    try {
      maxChars = maxChars || FALLBACK_MAX_CHARS;
      var body = document.body;
      if (!body) return '';
      var t = (typeof body.innerText !== 'undefined' ? body.innerText : body.textContent) || '';
      t = String(t).trim();
      return t.length > maxChars ? t.slice(0, maxChars) : t;
    } catch (e) {
      return '';
    }
  }

  function scrapeWithSelectors() {
    try {
      var host = getHostname();
      var cfg = SITE_SELECTORS[host];
      var jdText = '';
      if (cfg && cfg.jd) {
        for (var i = 0; i < cfg.jd.length; i++) {
          try {
            var el = document.querySelector(cfg.jd[i]);
            if (el) {
              var text = getVisibleText(el);
              if (text.length >= MIN_TEXT_LENGTH && JD_MATCH_KEYWORDS.some(function (k) { return text.indexOf(k) !== -1; })) {
                var skip = RECOMMEND_HEADERS.some(function (h) { return text.indexOf(h) === 0 || text.slice(0, 80).indexOf(h) !== -1; });
                if (!skip) { jdText = text; break; }
              }
            }
          } catch (_) {}
        }
      }
      if (!jdText) jdText = getRawPageText(FALLBACK_MAX_CHARS);
      return jdText;
    } catch (e) {
      return getRawPageText(FALLBACK_MAX_CHARS);
    }
  }

  function showToast(message, success) {
    try {
      var msg = (typeof message === 'string' ? message : (success ? '已复制' : '失败')) || (success ? '已复制' : '失败');
      var div = document.createElement('div');
      div.className = 'greeting-toast';
      div.textContent = msg;
      div.setAttribute('style', 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 20px;border-radius:8px;font-size:14px;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,0.15);' + (success ? 'background:#059669;color:#fff;' : 'background:#dc2626;color:#fff;'));
      if (document.body) document.body.appendChild(div);
      setTimeout(function () {
        try { if (div.parentNode) div.parentNode.removeChild(div); } catch (_) {}
      }, 2000);
    } catch (_) {}
  }

  chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
    try {
      if (request.type === 'SCRAPE_PAGE') {
        var text = '';
        try {
          text = request.raw === true ? getRawPageText(FALLBACK_MAX_CHARS) : scrapeWithSelectors();
        } catch (e) {
          text = getRawPageText(FALLBACK_MAX_CHARS);
        }
        sendResponse({ text: typeof text === 'string' ? text : '' });
        return false;
      }
      if (request.type === 'COPY_TO_CLIPBOARD') {
        var text = (request.text != null ? String(request.text) : '') || '';
        var toastMsg = (request.toastMessage != null ? String(request.toastMessage) : '') || '✅ 已复制';
        var ok = false;
        try {
          if (document.body) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.cssText = 'position:fixed;left:-9999px;top:0;';
            document.body.appendChild(textarea);
            textarea.select();
            try { ok = document.execCommand('copy'); } catch (_) {}
            if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
          }
        } catch (_) {}
        showToast(toastMsg, true);
        sendResponse({ ok: !!ok });
        return false;
      }
      if (request.type === 'SHOW_TOAST') {
        showToast(request.error || (request.success ? '成功' : '失败'), request.success);
        sendResponse({});
        return false;
      }
      sendResponse({});
    } catch (e) {
      try { sendResponse({ error: (e && e.message) ? e.message : 'content 执行异常', text: '' }); } catch (_) {}
    }
    return false;
  });
})();

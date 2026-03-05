(function () {
  const STORAGE_KEYS = {
    apiKey: 'apiKey',
    apiType: 'apiType',
    style: 'style',
    lastResumeHighlights: 'lastResumeHighlights',
    lastRawResume: 'lastRawResume',
    lastResumeFileName: 'lastResumeFileName',
    lastCleanedJd: 'lastCleanedJd'
  };

  const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
  const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  const el = {
    apiKey: document.getElementById('apiKey'),
    apiType: document.getElementById('apiType'),
    resumeFile: document.getElementById('resumeFile'),
    resumeFileName: document.getElementById('resumeFileName'),
    style: document.getElementById('style'),
    btnGenerate: document.getElementById('btnGenerate'),
    statusMsg: document.getElementById('status-msg'),
    message: document.getElementById('message')
  };

  function getBaseUrl() {
    var apiType = (el.apiType && el.apiType.value) ? el.apiType.value : 'openai';
    return apiType === 'gemini' ? GEMINI_BASE_URL : DEFAULT_BASE_URL;
  }

  function loadOptions() {
    chrome.storage.local.get([STORAGE_KEYS.apiKey, STORAGE_KEYS.apiType, STORAGE_KEYS.style, STORAGE_KEYS.lastResumeFileName], function (data) {
      if (data.apiKey != null && el.apiKey) el.apiKey.value = data.apiKey;
      if (data.apiType != null && el.apiType) el.apiType.value = data.apiType;
      if (data.style != null && el.style) el.style.value = data.style;
      var fn = (data[STORAGE_KEYS.lastResumeFileName] || '').trim();
      if (el.resumeFileName) el.resumeFileName.textContent = fn || '未选择任何文件';
    });
  }

  function setResumeFileName(name) {
    if (el.resumeFileName) el.resumeFileName.textContent = (name || '').trim() || '未选择任何文件';
  }

  function saveOptions() {
    var payload = {
      [STORAGE_KEYS.apiKey]: (el.apiKey && el.apiKey.value) ? el.apiKey.value.trim() : '',
      [STORAGE_KEYS.apiType]: (el.apiType && el.apiType.value) ? el.apiType.value : 'openai',
      [STORAGE_KEYS.style]: (el.style && el.style.value) ? el.style.value : '诚恳型'
    };
    return new Promise(function (resolve) {
      chrome.storage.local.set(payload, function () { resolve(); });
    });
  }

  function readTxtFile(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result || ''); };
      fr.onerror = function () { reject(new Error('读取文件失败')); };
      fr.readAsText(file, 'UTF-8');
    });
  }

  function extractTextFromPdf(arrayBuffer) {
    var pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) return Promise.reject(new Error('PDF 库未加载'));
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.js');
    return pdfjsLib.getDocument({ data: arrayBuffer }).promise.then(function (pdf) {
      var numPages = pdf.numPages;
      var parts = [];
      function getPage(n) {
        if (n > numPages) return Promise.resolve();
        return pdf.getPage(n).then(function (page) {
          return page.getTextContent().then(function (content) {
            var text = content.items.map(function (item) { return item.str; }).join('');
            parts.push(text);
            return getPage(n + 1);
          });
        });
      }
      return getPage(1).then(function () { return parts.join('\n'); });
    });
  }

  function onResumeFileChange(e) {
    var file = (e.target && e.target.files && e.target.files[0]) || null;
    if (!file) return;
    var fileName = (file.name || '').trim();
    var name = (file.name || '').toLowerCase();
    var isTxt = name.endsWith('.txt');
    var isPdf = name.endsWith('.pdf');

    chrome.storage.local.set({ [STORAGE_KEYS.lastResumeFileName]: fileName });
    setResumeFileName(fileName);

    function doExtractAndSave(rawText) {
      var apiKey = (el.apiKey && el.apiKey.value) ? el.apiKey.value.trim() : '';
      var baseUrl = getBaseUrl();
      var apiType = (el.apiType && el.apiType.value) ? el.apiType.value : 'openai';
      if (!apiKey) {
        showMessage('请先填写 API Key 后再上传简历', true);
        return;
      }
      chrome.storage.local.set({ [STORAGE_KEYS.lastRawResume]: rawText, [STORAGE_KEYS.lastResumeFileName]: fileName });
      showMessage('正在提炼简历…', false);
      chrome.runtime.sendMessage({
        type: 'EXTRACT_RESUME_HIGHLIGHTS',
        payload: { apiKey, baseUrl, apiType: apiType, resume: rawText }
      }, function (res) {
        if (res && !res.error && (res.text || '').trim()) {
          chrome.storage.local.set({ [STORAGE_KEYS.lastResumeHighlights]: (res.text || '').trim(), [STORAGE_KEYS.lastResumeFileName]: fileName });
          showMessage('简历已保存', false);
        } else {
          showMessage((res && res.error) ? res.error : '简历提炼失败，请重试', true);
        }
      });
    }

    if (isTxt) {
      readTxtFile(file).then(function (text) {
        var raw = (text || '').trim();
        if (!raw) { showMessage('文件为空', true); return; }
        doExtractAndSave(raw);
      }).catch(function (err) {
        showMessage((err && err.message) || '读取 TXT 失败', true);
      });
      e.target.value = '';
      return;
    }

    if (isPdf) {
      var fr = new FileReader();
      fr.onload = function () {
        extractTextFromPdf(fr.result).then(function (text) {
          var raw = (text || '').trim();
          if (!raw) {
            showMessage('该 PDF 未能解析出文字', true);
            return;
          }
          doExtractAndSave(raw);
        }).catch(function (err) {
          showMessage((err && err.message) || 'PDF 解析失败', true);
        });
      };
      fr.onerror = function () { showMessage('读取 PDF 文件失败', true); };
      fr.readAsArrayBuffer(file);
      e.target.value = '';
      return;
    }

    showMessage('仅支持 .txt 或 .pdf 文件', true);
    e.target.value = '';
  }

  function bindSave() {
    [el.apiKey, el.style, el.apiType].forEach(function (node) {
      if (node) {
        node.addEventListener('change', saveOptions);
        node.addEventListener('blur', saveOptions);
      }
    });
    if (el.resumeFile) el.resumeFile.addEventListener('change', onResumeFileChange);
  }

  function showMessage(text, isError) {
    if (el.message) {
      el.message.textContent = text || '';
      el.message.className = 'message ' + (isError ? 'error' : text ? 'success' : 'empty');
      if (text && isError && el.message.scrollIntoView) {
        el.message.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  function setStatus(text) {
    if (el.statusMsg) el.statusMsg.textContent = text || '';
  }

  function setGenerateLoading(loading) {
    if (el.btnGenerate) {
      el.btnGenerate.disabled = loading;
      el.btnGenerate.textContent = loading ? '生成中...' : '一键生成打招呼并复制';
    }
  }

  function isRestrictedUrl(url) {
    if (!url) return true;
    return /^chrome:\/\//.test(url) || /^edge:\/\//.test(url) || /^chrome-extension:\/\//.test(url);
  }

  function ensureContentScript(tabId) {
    return chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).then(function () { return true; }).catch(function () { return false; });
  }

  function scrapeCurrentPage(tabId, opts) {
    var raw = opts && opts.raw === true;
    var msg = { type: 'SCRAPE_PAGE' };
    if (raw) msg.raw = true;
    return chrome.tabs.sendMessage(tabId, msg).catch(function () {
      return ensureContentScript(tabId).then(function (ok) {
        return ok ? chrome.tabs.sendMessage(tabId, msg) : Promise.reject(new Error('无法注入页面'));
      }).catch(function () {
        return { error: '无法读取当前页面。请确保在招聘网站（如 Boss直聘、拉勾）的职位详情页打开。' };
      });
    });
  }

  function copyViaActiveTab(text, toastMessage) {
    return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id || isRestrictedUrl(tab.url)) return { ok: false, reason: '请切到普通网页再试' };
      return chrome.tabs.sendMessage(tab.id, { type: 'COPY_TO_CLIPBOARD', text: text, toastMessage: toastMessage }).then(function (res) {
        return (res && res.ok) ? { ok: true } : { ok: false, reason: res && res.reason };
      }).catch(function () {
        return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).then(function () {
          return chrome.tabs.sendMessage(tab.id, { type: 'COPY_TO_CLIPBOARD', text: text, toastMessage: toastMessage });
        }).then(function (res) {
          return (res && res.ok) ? { ok: true } : { ok: false, reason: '复制失败' };
        }).catch(function () { return { ok: false, reason: '无法注入' }; });
      });
    });
  }

  async function onGenerate() {
    if (!el.btnGenerate || !el.apiKey) return;
    var apiKey = (el.apiKey.value || '').trim();
    var baseUrl = getBaseUrl();
    var style = (el.style && el.style.value) ? el.style.value : '诚恳型';
    var apiType = (el.apiType && el.apiType.value) ? el.apiType.value : 'openai';

    if (!apiKey) {
      showMessage('请先填写 API Key', true);
      return;
    }

    await saveOptions();
    setGenerateLoading(true);
    setStatus('');
    showMessage('');
    await new Promise(function (r) { setTimeout(r, 50); });

    try {
      setStatus('🔍 正在读取岗位页...');
      var tabList = await chrome.tabs.query({ active: true, currentWindow: true });
      var tab = tabList[0];
      if (!tab || !tab.id) {
        showMessage('无法获取当前标签页', true);
        setStatus('');
        setGenerateLoading(false);
        return;
      }
      if (isRestrictedUrl(tab.url)) {
        showMessage('请先在招聘网站（Boss直聘/拉勾等）打开职位详情页', true);
        setStatus('');
        setGenerateLoading(false);
        return;
      }
      var rawResult = await scrapeCurrentPage(tab.id, { raw: true });
      if (rawResult.error) {
        showMessage(rawResult.error, true);
        setStatus('');
        setGenerateLoading(false);
        return;
      }
      var rawText = (rawResult.text || '').trim();
      if (!rawText || rawText.length < 50) {
        showMessage('当前页面文字过少，请打开职位详情页', true);
        setStatus('');
        setGenerateLoading(false);
        return;
      }
      setStatus('🧠 正在生成打招呼...');
      var greeting = await Promise.race([
        new Promise(function (resolve) {
          chrome.runtime.sendMessage({ type: 'RUN_FULL_GENERATE', rawText: rawText }, function (res) {
            if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message || '扩展通信失败' });
            } else {
              resolve(res || {});
            }
          });
        }),
        new Promise(function (_, reject) {
          setTimeout(function () { reject(new Error('请求超时（约 90 秒），请保持弹窗打开并重试')); }, 90000);
        })
      ]);
      if (greeting && greeting.error) {
        showMessage(greeting.error, true);
        setStatus('');
        setGenerateLoading(false);
        return;
      }
      var textToCopy = (greeting && greeting.text) ? String(greeting.text).trim() : '';
      if (!textToCopy) {
        showMessage('AI 未返回有效话术', true);
        setStatus('');
        setGenerateLoading(false);
        return;
      }

      var viaTab = await copyViaActiveTab(textToCopy, '打招呼已生成，立刻开聊吧！');
      if (!viaTab.ok) {
        try { await navigator.clipboard.writeText(textToCopy); } catch (_) {}
      }
      setStatus('✅ 话术已复制！快去 Ctrl+V。');
      showMessage('');
    } catch (err) {
      var msg = (err && err.message) ? err.message : '生成失败，请重试';
      showMessage(msg, true);
      setStatus('');
    } finally {
      setGenerateLoading(false);
    }
  }

  if (el.btnGenerate) el.btnGenerate.addEventListener('click', function () {
    onGenerate().catch(function (e) {
      showMessage((e && e.message) ? e.message : '生成失败', true);
      setStatus('');
      setGenerateLoading(false);
    });
  });
  loadOptions();
  bindSave();
})();

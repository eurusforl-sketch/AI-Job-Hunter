const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_JD_MODEL = 'gemini-2.5-flash';

function isGeminiUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') return false;
  try {
    var u = baseUrl.replace(/\/+$/, '').toLowerCase();
    return u.indexOf('generativelanguage.googleapis.com') !== -1 || (u.indexOf('googleapis.com') !== -1 && u.indexOf('gemini') !== -1);
  } catch (_) { return false; }
}

function buildPrompt(pageText, resume, style) {
  var styleHint = '';
  if (style === '诚恳型') {
    styleHint = '**本段话术风格（诚恳型）**：想象你是在真诚地给心仪岗位的 HR 发私信。不要用「贵司」，要用「咱们」。不要说「深感荣幸」，要说「很有兴趣」。语气要像是在做自我介绍，但带一点对这个岗位的研究。';
  } else if (style === '活泼型') {
    styleHint = '**本段话术风格（活泼型）**：像是在咖啡厅遇到未来的主管，语气轻松、自然、有活力。多用短句，少用书面语。去掉所有「本人」「获悉」之类的词。';
  } else {
    styleHint = '**本段话术风格（数据型）**：不要像报账一样列数据。要把数据融入到解决问题的背景中。语气专业且干练，展现出一种「我能帮你解决麻烦」的自信。';
  }
  return `请根据【岗位 JD】和【我的简历亮点】写一段招聘软件（如 Boss 直聘）上的打招呼，**有人情味**、像真人发消息。

【岗位 JD】：
${pageText}

【我的简历亮点】：
${resume}

${styleHint}

**通用要求（必须遵守）：**
- 彻底不用「贵司」「获悉」「本人」「胜任」「深表荣幸」等机器人词汇。统一用「咱们」或「您」，句子要短，像在手机上发消息。
- 不要打官腔，把简历亮点（如英语能力、Python 自动化、项目经验等）自然地揉进对话，不要罗列证书和分数。
- 开头带出我是谁/为什么找这个岗位（匹配度），中间 1～2 句讲我能解决什么、带来什么价值，结尾统一用「希望能和您聊聊」或「方便发份简历吗」之类。
- 不必写工作时间、工作地点等细节，突出匹配度和价值。严格 150 字以内。
- **格式（必须遵守）**：只输出一整段话术，整段在一行内完成，不要换行、不要分段、不要分点、不要使用任何换行符。无前缀、后缀或解释，且必须完整输出、不要截断。`;
}

function buildResumeExtractPrompt(resume) {
  return `下面【用户简历】是用户上传的简历原文。请用 AI 自动识别并提炼出「简历精华」，**仅用于后续写打招呼**时参考。

请从简历中提取并整理出以下内容（有则写，无则略），按类分条、简洁清晰：

1. **个人优势**：自我评价、核心优势、性格或能力亮点。
2. **工作时间 / 工作时长**：各段工作的起止时间、累计年限等。
3. **工作技能**：与求职相关的技能、工具、语言、证书等。
4. **岗位信息**：曾任职的公司、岗位名称、主要职责与成果（可量化）。
5. **项目信息**：重要项目的背景、你的角色、关键成果，与岗位相关的优先。
6. **个人特长**：在哪些方面比较出挑、与目标岗位相关的亮点。

若简历中有姓名或称呼，请在开头保留。总字数 500～1200 字，直接输出简历精华正文，无前缀、后缀。

【用户简历】全文如下：
---
${resume}
---`;
}

function buildCleanJdPrompt(rawText) {
  return `从下面招聘页原文中，仅删除与「当前这条岗位」无关的整块（推荐职位、其他公司、导航、页脚、广告）。保留当前岗位的职位描述/职责/要求/福利等全部原文，不总结不改写。直接输出清理后全文，无前缀后缀。若与招聘无关则输出「无有效招聘信息」。

原文：
${rawText}`;
}

function callChatApi(apiKey, baseUrl, userContent, sendResponse, options) {
  options = options || {};
  var maxTokens = options.maxTokens != null ? options.maxTokens : 512;
  var url = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '') + '/chat/completions';
  var body = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: userContent }],
    max_tokens: maxTokens,
    temperature: options.temperature != null ? options.temperature : 0.5
  };
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (apiKey || '') },
    body: JSON.stringify(body)
  })
    .then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error('API 请求失败：' + res.status + (t ? ' - ' + t.slice(0, 200) : '')); });
      return res.json();
    })
    .then(function (data) {
      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (content != null) sendResponse({ text: typeof content === 'string' ? content : String(content) });
      else sendResponse({ error: 'API 返回格式异常' });
    })
    .catch(function (err) { sendResponse({ error: (err && err.message) ? err.message : '网络或接口错误' }); });
}

function callGeminiApi(apiKey, baseUrl, userContent, sendResponse, options) {
  options = options || {};
  var maxTokens = options.maxTokens != null ? options.maxTokens : 512;
  var temperature = options.temperature != null ? options.temperature : 0.5;
  var base = (baseUrl || GEMINI_BASE_URL).replace(/\/+$/, '');
  var url = base + '/models/' + (options.model || GEMINI_MODEL) + ':generateContent?key=' + encodeURIComponent(apiKey || '');
  var body = {
    contents: [{ parts: [{ text: userContent }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: temperature }
  };
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error('Gemini API 请求失败：' + res.status + (t ? ' - ' + t.slice(0, 200) : '')); });
      return res.json();
    })
    .then(function (data) {
      var cand = data.candidates && data.candidates[0];
      var parts = cand && cand.content && cand.content.parts;
      var text = '';
      if (parts && parts.length) {
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i].text;
          if (p != null) text += (typeof p === 'string' ? p : String(p));
        }
      }
      if (text) sendResponse({ text: text });
      else sendResponse({ error: 'Gemini 返回格式异常' });
    })
    .catch(function (err) { sendResponse({ error: (err && err.message) ? err.message : '网络或接口错误' }); });
}

function getBaseUrlByType(apiType) {
  return apiType === 'gemini' ? GEMINI_BASE_URL : DEFAULT_BASE_URL;
}

function cleanJdAsync(apiKey, baseUrl, apiType, rawText) {
  return new Promise(function (resolve, reject) {
    var userContent = buildCleanJdPrompt(rawText);
    var useGemini = apiType === 'gemini' || isGeminiUrl(baseUrl);
    var done = function (res) {
      if (res.error) reject(new Error(res.error));
      else resolve(res.text || '');
    };
    if (useGemini) {
      callGeminiApi(apiKey, baseUrl, userContent, done, { model: GEMINI_JD_MODEL, maxTokens: 8192, temperature: 0.1 });
    } else {
      callChatApi(apiKey, baseUrl, userContent, done, { maxTokens: 8192, temperature: 0.1 });
    }
  });
}

function extractResumeAsync(apiKey, baseUrl, apiType, resume) {
  return new Promise(function (resolve, reject) {
    var userContent = buildResumeExtractPrompt(resume);
    var useGemini = apiType === 'gemini' || isGeminiUrl(baseUrl);
    var done = function (res) {
      if (res.error) reject(new Error(res.error));
      else resolve((res.text || '').trim());
    };
    if (useGemini) {
      callGeminiApi(apiKey, baseUrl, userContent, done, { maxTokens: 4096, temperature: 0.4 });
    } else {
      callChatApi(apiKey, baseUrl, userContent, done);
    }
  });
}

function generateGreetingAsync(apiKey, baseUrl, apiType, pageText, resume, style) {
  return new Promise(function (resolve, reject) {
    var userContent = buildPrompt(pageText, resume, style || '诚恳型');
    var useGemini = apiType === 'gemini' || isGeminiUrl(baseUrl);
    var done = function (res) {
      if (res.error) reject(new Error(res.error));
      else resolve(res.text || '');
    };
    if (useGemini) {
      callGeminiApi(apiKey, baseUrl, userContent, done, { maxTokens: 2048, temperature: 0.5 });
    } else {
      var url = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '') + '/chat/completions';
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (apiKey || '') },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: userContent }],
          max_tokens: 1024,
          temperature: 0.5
        })
      })
        .then(function (res) {
          if (!res.ok) return res.text().then(function (t) { throw new Error('API 失败：' + res.status); });
          return res.json();
        })
        .then(function (data) {
          var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (content != null) {
            var text = (typeof content === 'string' ? content : String(content)).replace(/\r\n|\r|\n/g, ' ').trim();
            resolve(text);
          }
          else reject(new Error('返回格式异常'));
        })
        .catch(function (err) { reject(err); });
    }
  });
}

function runFullGenerate(rawText, sendResponse) {
  var responded = false;
  function reply(res) {
    if (responded) return;
    responded = true;
    try { sendResponse(res); } catch (_) {}
  }
  if ((rawText != null ? String(rawText) : '').trim().length < 50) {
    reply({ error: '当前页面文字过少' });
    return;
  }
  rawText = (rawText != null ? String(rawText) : '').trim();
  chrome.storage.local.get(['apiKey', 'apiType', 'style', 'lastResumeHighlights', 'lastRawResume'], function (data) {
    var apiKey = (data.apiKey != null ? String(data.apiKey) : '').trim();
    var apiType = data.apiType || 'openai';
    var style = data.style || '诚恳型';
    var lastResumeHighlights = (data.lastResumeHighlights != null ? String(data.lastResumeHighlights) : '').trim();
    var lastRawResume = (data.lastRawResume != null ? String(data.lastRawResume) : '').trim();
    if (!apiKey) {
      reply({ error: '请先在扩展中填写 API Key' });
      return;
    }
    function doGenerate(resumeHighlights) {
      var baseUrl = getBaseUrlByType(apiType);
      cleanJdAsync(apiKey, baseUrl, apiType, rawText)
        .then(function (cleaned) {
          if (!cleaned || cleaned.indexOf('无有效招聘信息') !== -1) {
            reply({ error: '未识别到有效招聘信息' });
            return undefined;
          }
          return generateGreetingAsync(apiKey, baseUrl, apiType, cleaned, resumeHighlights, style);
        })
        .then(function (greeting) {
          if (responded) return;
          var text = (greeting && (greeting + '').trim()) ? (greeting + '').replace(/\r\n|\r|\n/g, ' ').trim() : '';
          if (text) reply({ text: text });
          else reply({ error: '未返回话术' });
        })
        .catch(function (err) {
          if (!responded) reply({ error: (err && err.message) ? err.message : '生成失败' });
        });
    }
    if (lastResumeHighlights) {
      doGenerate(lastResumeHighlights);
    } else if (lastRawResume) {
      extractResumeAsync(apiKey, getBaseUrlByType(apiType), apiType, lastRawResume)
        .then(function (highlights) {
          var h = (highlights || '').trim();
          if (h) chrome.storage.local.set({ lastResumeHighlights: h });
          if (!h) {
            reply({ error: '简历提炼失败，请重试' });
            return;
          }
          doGenerate(h);
        })
        .catch(function (err) {
          if (!responded) reply({ error: (err && err.message) ? err.message : '简历提炼失败' });
        });
    } else {
      reply({ error: '请先在扩展中上传简历' });
    }
  });
}

chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
  if (request.type === 'RUN_FULL_GENERATE') {
    runFullGenerate(request.rawText, sendResponse);
    return true;
  }

  if (request.type === 'CLEAN_JD') {
    var payload = request.payload || {};
    var apiKey = payload.apiKey;
    var baseUrl = payload.baseUrl;
    var apiType = payload.apiType;
    var rawText = payload.rawText || '';
    if (!rawText || rawText.length < 50) {
      sendResponse({ error: '页面原文过短' });
      return true;
    }
    var userContent = buildCleanJdPrompt(rawText);
    var useGemini = apiType === 'gemini' || isGeminiUrl(baseUrl);
    if (useGemini) {
      callGeminiApi(apiKey, baseUrl, userContent, sendResponse, { model: GEMINI_JD_MODEL, maxTokens: 8192, temperature: 0.1 });
    } else {
      callChatApi(apiKey, baseUrl, userContent, sendResponse, { maxTokens: 8192, temperature: 0.1 });
    }
    return true;
  }

  if (request.type === 'EXTRACT_RESUME_HIGHLIGHTS') {
    var payload = request.payload || {};
    var apiKey = payload.apiKey;
    var baseUrl = payload.baseUrl;
    var apiType = payload.apiType;
    var resume = payload.resume || '';
    var userContent = buildResumeExtractPrompt(resume);
    var useGemini = apiType === 'gemini' || isGeminiUrl(baseUrl);
    if (useGemini) {
      callGeminiApi(apiKey, baseUrl, userContent, sendResponse, { maxTokens: 4096, temperature: 0.4 });
    } else {
      callChatApi(apiKey, baseUrl, userContent, sendResponse);
    }
    return true;
  }

  if (request.type === 'GENERATE_GREETING') {
    var payload = request.payload || {};
    var apiKey = payload.apiKey;
    var baseUrl = payload.baseUrl;
    var apiType = payload.apiType;
    var pageText = (payload.pageText || '').trim();
    var resume = (payload.resume || '').trim();
    var style = payload.style || '诚恳型';
    if (!pageText) {
      sendResponse({ error: '缺少岗位 JD，请先在职位详情页再试' });
      return true;
    }
    if (!resume) {
      sendResponse({ error: '缺少简历精华，请先上传简历并等待提炼完成' });
      return true;
    }
    var userContent = buildPrompt(pageText, resume, style);
    var useGemini = apiType === 'gemini' || isGeminiUrl(baseUrl);
    function stripNewlinesAndSend(res) {
      if (res && res.text) res.text = (res.text + '').replace(/\r\n|\r|\n/g, ' ').trim();
      sendResponse(res);
    }
    if (useGemini) {
      callGeminiApi(apiKey, baseUrl, userContent, stripNewlinesAndSend, { maxTokens: 2048, temperature: 0.5 });
    } else {
      var url = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '') + '/chat/completions';
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (apiKey || '') },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: userContent }],
          max_tokens: 1024,
          temperature: 0.5
        })
      })
        .then(function (res) {
          if (!res.ok) return res.text().then(function (t) { throw new Error('API 失败：' + res.status); });
          return res.json();
        })
        .then(function (data) {
          var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (content != null) {
            var text = (typeof content === 'string' ? content : String(content)).replace(/\r\n|\r|\n/g, ' ').trim();
            sendResponse({ text: text });
          } else sendResponse({ error: '返回格式异常' });
        })
        .catch(function (err) { sendResponse({ error: (err && err.message) ? err.message : '请求失败' }); });
    }
    return true;
  }

  sendResponse({ error: '未知请求类型' });
  return false;
});

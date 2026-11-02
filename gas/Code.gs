/**
 * 문맥 추론 점검 모형 · 통합 서버 (앱 1~3 + 교사 페이지 + 앱 3 관리자)
 *
 * 깃허브(GitHub Pages)에 올린 웹뷰어가 이 스크립트에 fetch POST 로 요청합니다.
 * 앱 HTML 은 깃허브에 있으므로 이 프로젝트에는 Code.gs 하나만 있으면 됩니다.
 *
 * 쓰는 법
 * 1. 새 구글 시트 → [확장 프로그램] → [Apps Script] → 이 코드를 Code.gs 에 붙여 넣기
 * 2. [배포] → [새 배포] → 유형: 웹 앱
 *      다음 사용자 인증 정보로 실행: 나
 *      액세스 권한이 있는 사용자: 모든 사용자
 * 3. 나온 주소(/exec 로 끝남)를 깃허브 저장소의 config.js → API_URL 에 넣기
 * 4. 코드를 고친 뒤에는 [배포] → [배포 관리] → 연필 → 버전: '새 버전' 으로 다시 배포 (주소는 그대로)
 *
 * 시트(탭)는 처음 쓸 때 저절로 생깁니다.
 *   앱1 기록 · 우리반낱말 · 학생기록 : 앱 1~2
 *   앱3 투표 · 앱3 기록 · 앱3 어구 : 앱 3
 *
 * 관리자 비밀번호: 웹뷰어 [교사] → 어구 관리에서 처음 적은 비밀번호가 됩니다. 배포 직후 바로 정해 두세요.
 *   잊었으면 편집기에서 resetAdminPassword 를 한 번 실행합니다.
 *
 * 개인정보: 학생 이름은 받지 않습니다. 학교명은 웹뷰어가 보내기 전에 'S-xxxxxx' 가명 코드로 바꿔 보냅니다(config.js).
 */

const SPREADSHEET_ID = '';   // 독립 스크립트로 만들었다면 시트 ID. 시트에서 만들었다면 비워 둡니다.

/* ===== 웹 요청 입구 ===== */
// 웹뷰어에서 부를 수 있는 함수만 여기에 적습니다. (지우기·비밀번호 초기화는 일부러 뺐어요)
const API = {
  ping: () => ({ ok: true, time: new Date().toISOString() }),
  // 앱 1
  saveApp1Record: saveApp1Record,
  // 앱 2
  getClassSentences: getClassSentences,
  addClassSentences: addClassSentences,
  deleteClassSentence: deleteClassSentence,
  saveApp2Records: saveApp2Records,
  // 교사 페이지: 비밀번호를 확인한 뒤 결과를 반환한다.
  getApp1Records: getApp1Records,
  getApp2Records: getApp2Records,
  getApp3Records: getApp3Records,
  // 앱 3
  saveApp3Vote: saveApp3Vote,
  getApp3Votes: getApp3Votes,
  saveApp3Records: saveApp3Records,
  getApp3Lexicon: getApp3Lexicon,
  // 앱 3 관리자
  adminLogin: adminLogin,
  adminLoadRows: adminLoadRows,
  adminSaveRows: adminSaveRows
};

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = API[req.fn];
    if (!fn) throw new Error('없는 기능이에요: ' + req.fn);
    out = { ok: true, result: fn.apply(null, Array.isArray(req.args) ? req.args : []) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// 주소를 브라우저로 열어 보면 연결 상태를 알려 줍니다.
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, name: '문맥 추론 점검 모형 서버', time: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ===== 시트 준비 ===== */
function ss_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* =====================================================================
   앱 2 · 주변 단어는 어떤 단서가 될까?
   ===================================================================== */
const SHEET_WORDS = '우리반낱말';
const SHEET_RECORDS = '학생기록';
const WORD_HEADERS = ['id', '낱말', '넣은 말', '넣은 시각'];
const RECORD_HEADERS = ['보낸 시각', '학교(가명)', '번호', '단계', '항목', '처음 판단', '근거', '유지/수정', '최종', '문장 틀'];

function getClassSentences() {
  const sh = sheet_(SHEET_WORDS, WORD_HEADERS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 3).getValues()
    .filter(r => r[0] && r[2])
    .map(r => ({ id: String(r[0]), word: String(r[1]), text: String(r[2]) }));
}

function addClassSentences(items) {
  withLock_(() => {
    const sh = sheet_(SHEET_WORDS, WORD_HEADERS);
    const now = new Date();
    const rows = (items || [])
      .filter(it => it && it.text)
      .map(it => [String(it.id || Utilities.getUuid()), String(it.word || ''), String(it.text).slice(0, 40), now]);
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, WORD_HEADERS.length).setValues(rows);
  });
  return getClassSentences();
}

function deleteClassSentence(id) {
  withLock_(() => {
    const sh = sheet_(SHEET_WORDS, WORD_HEADERS);
    const last = sh.getLastRow();
    if (last >= 2) {
      const ids = sh.getRange(2, 1, last - 1, 1).getValues();
      for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === String(id)) sh.deleteRow(i + 2);
    }
  });
  return getClassSentences();
}

function saveApp2Records(rows) {
  return withLock_(() => {
    const sh = sheet_(SHEET_RECORDS, RECORD_HEADERS);
    const now = new Date();
    const values = (rows || []).map(r => [now, r.school || '', r.no || '', r.step || '', r.item || '',
      r.first || '', r.evidence || '', r.keep || '', r.final || '', r.frames || '']);
    if (values.length) sh.getRange(sh.getLastRow() + 1, 1, values.length, RECORD_HEADERS.length).setValues(values);
    return values.length;
  });
}

/* =====================================================================
   앱 1 · BoW 활동 기록
   ===================================================================== */
const APP1_RECORD_SHEET = '앱1 기록';
const APP1_RECORD_HEADERS = ['보낸 시각', '학교(가명)', '번호', '제목', '입력 문장', '활동 결과'];

function saveApp1Record(record) {
  const r = record || {};
  withLock_(() => {
    const sh = sheet_(APP1_RECORD_SHEET, APP1_RECORD_HEADERS);
    sh.appendRow([new Date(), r.school || '', String(r.no || ''), r.title || '',
      r.inputText || '', JSON.stringify(r.data || {})]);
  });
  return true;
}

function getApp1Records(pw) {
  checkPw_(pw);
  const sh = ss_().getSheetByName(APP1_RECORD_SHEET);
  if (!sh || sh.getLastRow() < 2) return { headers: APP1_RECORD_HEADERS, rows: [] };
  return { headers: APP1_RECORD_HEADERS, rows: sh.getRange(2, 1, sh.getLastRow() - 1, APP1_RECORD_HEADERS.length).getDisplayValues() };
}

function getApp2Records(pw) {
  checkPw_(pw);
  const sh = ss_().getSheetByName(SHEET_RECORDS);
  if (!sh || sh.getLastRow() < 2) return { headers: RECORD_HEADERS, rows: [] };
  return { headers: RECORD_HEADERS, rows: sh.getRange(2, 1, sh.getLastRow() - 1, RECORD_HEADERS.length).getDisplayValues() };
}

/* =====================================================================
   앱 3 · 같은 낱말, 옆 말로 뜻을 나눌 수 있을까?
   ===================================================================== */
const VOTE_SHEET = '앱3 투표';
const VOTE_HEAD = ['시각', '학교(가명)', '번호', '반', '질문', '답'];
const APP3_RECORD_HEADERS = ['보낸 시각', '학교(가명)', '번호', '낱말', '구분', '문장', '처음 고른 뜻', '단서 말', '컴퓨터 덩어리/같은·다른 뜻', '덩어리 이름표',
  '유지/수정', '점검 후 뜻', '근거 문장', '컴퓨터 예측', '단계 정리 문장(1/2/3)'];

function saveApp3Vote(v) {
  const sh = sheet_(VOTE_SHEET, VOTE_HEAD);
  withLock_(() => sh.appendRow([new Date(), v.school, String(v.no), v.classKey, v.key, v.value]));
  return getApp3Votes(v.classKey);
}

function getApp3Votes(classKey) {
  const sh = ss_().getSheetByName(VOTE_SHEET);
  if (!sh || sh.getLastRow() < 2) return {};
  const last = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => {
    if (String(r[3]) !== String(classKey)) return;
    last[r[2] + '|' + r[4]] = { key: r[4], value: r[5] };   // 학생마다 질문별 마지막 답만
  });
  const out = {};
  Object.keys(last).forEach(k => {
    const x = last[k];
    out[x.key] = out[x.key] || {};
    out[x.key][x.value] = (out[x.key][x.value] || 0) + 1;
  });
  return out;
}

function saveApp3Records(rows) {
  return withLock_(() => {
    const sh = sheet_('앱3 기록', APP3_RECORD_HEADERS);
    const now = new Date();
    const values = (rows || []).map(r => [now, r.school || '', r.no, r.word, r.kind, r.sentence, r.first, r.clues, r.group, r.groupName,
      r.keep, r.final, r.why, r.predict || '', r.frames]);
    if (values.length) sh.getRange(sh.getLastRow() + 1, 1, values.length, APP3_RECORD_HEADERS.length).setValues(values);
    return values.length;
  });
}

function getApp3Records(pw) {
  checkPw_(pw);
  const sh = ss_().getSheetByName('앱3 기록');
  if (!sh || sh.getLastRow() < 2) return { headers: APP3_RECORD_HEADERS, rows: [] };
  const values = sh.getDataRange().getDisplayValues();
  return { headers: values[0], rows: values.slice(1) };
}

/* ----- 어구 ('앱3 어구' 탭) ----- */
const PHRASE_SHEET = '앱3 어구';
const PHRASE_HEAD = ['반', '모둠', '단어', '뜻코드', '어구', '쓰임', '원래 어구', '학습 결과'];

function readPhrases_() {
  const sh = ss_().getSheetByName(PHRASE_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, PHRASE_HEAD.length).getDisplayValues()
    .filter(r => r[2] && r[4])
    .map(r => ({ cls: r[0], group: r[1], word: String(r[2]).trim(), code: Number(String(r[3]).replace(/\D/g, '')) || 0,
      text: String(r[4]).trim(), use: String(r[5]).trim() || '창고', orig: r[6], learned: r[7] || '' }));
}

// 학생 앱: 수업·점검 어구를 낱말별로 (뜻코드 1·2·3 → 뜻 A·B·C)
function getApp3Lexicon() {
  const ids = ['A', 'B', 'C'], out = {};
  readPhrases_().forEach(p => {
    if (p.use !== '수업' && p.use !== '점검') return;
    if (!(p.code >= 1 && p.code <= 3)) return;
    const w = out[p.word] || (out[p.word] = { sentences: [], checks: [] });
    const item = { text: p.text, m: ids[p.code - 1] };
    if (p.use === '수업') w.sentences.push(item); else w.checks.push({ text: item.text, m: item.m, learned: p.learned || '' });
  });
  return out;
}

/* ----- 관리자 ----- */
function checkPw_(pw) {
  const saved = PropertiesService.getScriptProperties().getProperty('ADMIN_PW');
  if (!saved || String(pw) !== saved) throw new Error('비밀번호가 맞지 않아요. 다시 들어와 주세요.');
}

function adminLogin(pw) {
  pw = String(pw || '');
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty('ADMIN_PW');
  if (!saved) {
    if (pw.length < 4) return { ok: false, msg: '처음이에요. 4자 이상으로 비밀번호를 정해 주세요.' };
    props.setProperty('ADMIN_PW', pw);
    return { ok: true, first: true, url: '' };
  }
  return pw === saved ? { ok: true, first: false, url: '' } : { ok: false, msg: '비밀번호가 맞지 않아요.' };
}

function adminLoadRows(pw) {
  checkPw_(pw);
  return readPhrases_();
}

function adminSaveRows(pw, rows) {
  checkPw_(pw);
  return withLock_(() => {
    const sh = sheet_(PHRASE_SHEET, PHRASE_HEAD);
    sh.getRange(1, 1, 1, PHRASE_HEAD.length).setValues([PHRASE_HEAD]);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, PHRASE_HEAD.length).clearContent();
    const values = (rows || []).map(r => [r.cls || '', r.group || '', r.word, r.code, r.text, r.use || '창고', r.orig || '', r.learned || '']);
    if (values.length) sh.getRange(2, 1, values.length, PHRASE_HEAD.length).setNumberFormat('@').setValues(values);
    return values.length;
  });
}

// 비밀번호를 잊었을 때 편집기에서 한 번 실행
function resetAdminPassword() {
  PropertiesService.getScriptProperties().deleteProperty('ADMIN_PW');
}

/* =====================================================================
   선생님 메뉴 (시트 위쪽 [수업 관리])
   ===================================================================== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('수업 관리')
    .addItem('앱 2 · 우리 반 낱말 모두 지우기', 'menuClearWords')
    .addItem('앱 2 · 학생 기록 모두 지우기', 'menuClearRecords')
    .addSeparator()
    .addItem('앱 3 · 우리 반 투표 모두 지우기', 'menuClearVotes')
    .addItem('앱 3 · 학생 기록 모두 지우기', 'menuClearApp3Records')
    .addToUi();
}
function confirmClear_(title, sheetName) {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert(title, '지운 내용은 되돌릴 수 없어요.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  withLock_(() => {
    const sh = ss_().getSheetByName(sheetName);
    if (sh && sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getMaxColumns()).clearContent();
  });
  ui.alert('지웠어요.');
}
function menuClearWords() { confirmClear_('우리 반 낱말을 모두 지울까요?', SHEET_WORDS); }
function menuClearRecords() { confirmClear_('앱 2 학생 기록을 모두 지울까요?', SHEET_RECORDS); }
function menuClearVotes() { confirmClear_('앱 3 우리 반 투표를 모두 지울까요?', VOTE_SHEET); }
function menuClearApp3Records() { confirmClear_('앱 3 학생 기록을 모두 지울까요?', '앱3 기록'); }

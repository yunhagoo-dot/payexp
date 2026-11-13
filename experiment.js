/* 모바일 결제 완료음의 신뢰감 평가 — 인간공학실험 6조 */

const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: true,
  message_progress_bar: '진행률',
});

const PID = jsPsych.randomization.randomID(8).toUpperCase();
const SRC = jsPsych.data.getURLVariable('src') || '';
const START = new Date();
const P = { pid: PID, src: SRC, start: START.toISOString(), ua: navigator.userAgent,
            mobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) };
const TRIALS = [];

/* ---------------- 오디오 ---------------- */
const AUDIO = { ctx: null, buf: {}, src: null };
function ctx() {
  if (!AUDIO.ctx) AUDIO.ctx = new (window.AudioContext || window.webkitAudioContext)();
  return AUDIO.ctx;
}
async function unlockAudio() {
  // iOS 16.4+: 무음 스위치가 켜져 있어도 소리가 나도록 '미디어 재생'으로 지정
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  const c = ctx();
  if (c.state !== 'running') { try { await c.resume(); } catch (e) {} }
  // iOS: 무음 버퍼를 한 번 재생해 오디오 잠금 해제
  const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
}
function decode(ab) {
  return new Promise((res, rej) => ctx().decodeAudioData(ab, res, rej));
}
async function loadAll(files, onProgress) {
  let n = 0;
  await Promise.all(files.map(async (f) => {
    const r = await fetch(f);
    if (!r.ok) throw new Error(f + ' 파일을 찾을 수 없습니다');
    AUDIO.buf[f] = await decode(await r.arrayBuffer());
    onProgress(++n, files.length);
  }));
}
function play(file, { loop = false, onended = null } = {}) {
  stopAudio();
  const c = ctx();
  if (c.state !== 'running') c.resume();
  const s = c.createBufferSource();
  s.buffer = AUDIO.buf[file]; s.loop = loop; s.connect(c.destination);
  s.onended = () => { if (AUDIO.src === s) AUDIO.src = null; if (onended) onended(); };
  s.start();
  AUDIO.src = s;
}
function stopAudio() {
  if (AUDIO.src) { const s = AUDIO.src; AUDIO.src = null; s.onended = null; try { s.stop(); } catch (e) {} }
}

/* ---------------- 자극 목록 ---------------- */
const PROG = { same: '동일음 반복', rise: '상승', fall: '하강' };
const TIMB = { sine: '순음', bell: '벨', marimba: '마림바' };
const LEN = { short: '짧게', long: '길게' };
const SYN = [];
for (const p of Object.keys(PROG)) for (const t of Object.keys(TIMB)) for (const l of Object.keys(LEN))
  SYN.push({ file: `${p}_${t}_${l}.wav`, stim: `${p}_${t}_${l}`, prog: p, timbre: t, len: l, is_ref: 0 });
const REF = REFS.map((r, i) => ({ file: r.file, stim: 'ref' + (i + 1), prog: '', timbre: '', len: '', is_ref: 1, app: r.app }));
const HP = [1, 2, 3, 1, 2, 3].map((a, i) => ({ file: `hp${i + 1}.wav`, answer: a }));
const ALL_FILES = [...SYN, ...REF].map((s) => s.file)
  .concat(['practice2.wav', 'calibration.wav'], HP.map((h) => h.file));

/* ---------------- 공통 ---------------- */
const page = (html) => `<div class="page">${html}</div>`;
const scale7 = (name, required = true) =>
  [1, 2, 3, 4, 5, 6, 7].map((v) =>
    `<label class="pt"><input type="radio" name="${name}" value="${v}" ${required && v === 1 ? 'required' : ''}><span>${v}</span></label>`).join('');

/* ---------------- 1. 안내·동의 ---------------- */
const consent = {
  type: jsPsychSurveyHtmlForm,
  html: page(`
    <h2>결제 완료음 평가 실험</h2>
    <p>서울대학교 인간공학실험 6조의 수업 실험입니다. 휴대폰 결제가 끝났을 때 나는 짧은 소리들을 듣고, 각 소리에서 받는 느낌을 평가합니다.</p>
    <ul>
      <li>소요 시간: 약 10분</li>
      <li>준비물: <b>이어폰 또는 헤드폰</b> (스피커로는 참여할 수 없습니다), 조용한 장소</li>
      <li>이름, 연락처 등 개인을 알아볼 수 있는 정보는 수집하지 않으며, 응답은 수업 보고서 작성에만 쓰입니다.</li>
      <li>참여는 자유이며 언제든 창을 닫아 그만둘 수 있습니다. 중간에 그만두면 응답은 저장되지 않습니다.</li>
    </ul>
    <label class="agree"><input type="checkbox" name="agree" value="yes" required> 위 내용을 읽었으며 실험 참여에 동의합니다.</label>`),
  button_label: '동의하고 시작',
  on_finish: () => { unlockAudio(); },
};

/* ---------------- 2. 음원 불러오기 ---------------- */
const loading = {
  type: jsPsychHtmlButtonResponse,
  stimulus: page(`<h3>소리 파일을 불러오는 중입니다</h3><p id="ld">0 / ${ALL_FILES.length}</p>`),
  choices: ['다음'],
  on_load: () => {
    const btn = document.querySelector('.jspsych-btn'); btn.disabled = true;
    loadAll(ALL_FILES, (n, N) => { document.getElementById('ld').textContent = `${n} / ${N}`; })
      .then(() => { document.getElementById('ld').textContent = '준비 완료'; btn.disabled = false; })
      .catch((e) => { document.getElementById('ld').innerHTML = `<span class="err">불러오기 실패: ${e.message}<br>새로고침 후 다시 시도해 주세요.</span>`; });
  },
};

/* ---------------- 3. 기본 정보·참여 조건 ---------------- */
const demo = {
  type: jsPsychSurveyHtmlForm,
  html: page(`
    <h3>기본 정보</h3>
    <div class="q"><label>만 나이 <input type="number" name="age" min="15" max="80" required></label></div>
    <div class="q">성별
      <select name="gender" required><option value="">선택</option><option>여성</option><option>남성</option><option>응답 안 함</option></select></div>
    <div class="q">가장 자주 쓰는 간편결제 앱
      <select name="app" required><option value="">선택</option><option>토스</option><option>카카오페이</option><option>네이버페이</option><option>삼성페이</option><option>애플페이</option><option>기타</option></select></div>
    <div class="q">모바일 간편결제 사용 빈도
      <select name="freq" required><option value="">선택</option><option value="daily">거의 매일</option><option value="weekly">주 1회 이상</option><option value="less">주 1회 미만</option></select></div>
    <div class="q">청력에 이상이 있다고 진단받았거나 느끼시나요?
      <select name="hearing" required><option value="">선택</option><option value="no">아니요</option><option value="yes">예</option></select></div>
    <div class="q">지금 무엇으로 소리를 듣나요?
      <select name="device" required><option value="">선택</option><option value="wired">유선 이어폰</option><option value="wireless">무선 이어폰</option><option value="headphone">헤드폰</option><option value="speaker">스피커(이어폰 없음)</option></select></div>`),
  button_label: '다음',
  on_finish: (d) => {
    Object.assign(P, d.response);
    const age = Number(P.age);
    P.eligible = (age >= 20 && age <= 29 && P.freq !== 'less' && P.hearing === 'no' && P.device !== 'speaker') ? 1 : 0;
  },
};
const ineligible = {
  timeline: [{
    type: jsPsychHtmlButtonResponse,
    stimulus: () => page(`<h3>참여해 주셔서 감사합니다</h3>
      <p>이 실험은 <b>만 20~29세</b>, <b>간편결제 주 1회 이상 사용</b>, <b>청력 이상 없음</b>, <b>이어폰·헤드폰 착용</b> 조건에 맞는 분을 대상으로 합니다.</p>
      <p>${P.device === 'speaker' ? '이어폰이나 헤드폰을 연결한 뒤 다시 접속해 주시면 참여할 수 있습니다.' : '아쉽지만 이번 실험 대상에 해당하지 않습니다.'}</p>`),
    choices: ['종료'],
    on_finish: async () => { P.status = 'ineligible'; await save(); jsPsych.abortExperiment(page('<p>창을 닫으셔도 됩니다.</p>')); },
  }],
  conditional_function: () => !P.eligible,
};

/* ---------------- 4. 볼륨 보정 ---------------- */
const calib = {
  type: jsPsychHtmlButtonResponse,
  stimulus: page(`
    <h3>볼륨 맞추기</h3>
    <p>이어폰을 착용하고 아래 버튼을 눌러 주세요. 계속 울리는 소리가 <b>편안하게 잘 들리는 크기</b>가 되도록 기기 볼륨을 조절합니다.</p>
    <p><b>이후 실험이 끝날 때까지 볼륨을 바꾸지 마세요.</b></p>
    <p class="muted">소리가 안 들리면: 아이폰은 옆면 무음 스위치를 끄고, 블루투스 이어폰이 연결됐는지 확인한 뒤 다시 눌러 보세요.</p>
    <button type="button" id="cal" class="jspsych-btn big">▶ 보정음 재생</button>`),
  choices: ['볼륨을 맞췄어요'],
  on_load: () => {
    const next = document.querySelector('#jspsych-html-button-response-btngroup .jspsych-btn'); next.disabled = true;
    const b = document.getElementById('cal'); let on = false;
    b.onclick = () => {
      if (on) { stopAudio(); b.textContent = '▶ 보정음 재생'; on = false; }
      else { unlockAudio(); play('calibration.wav', { loop: true }); b.textContent = '■ 멈춤'; on = true; next.disabled = false; }
    };
  },
  on_finish: stopAudio,
};

/* ---------------- 5. 헤드폰 확인(Woods et al., 2017) ---------------- */
let hpScore = 0;
const hpIntro = {
  type: jsPsychHtmlButtonResponse,
  stimulus: page(`<h3>이어폰 확인</h3><p>낮은 "삐—" 소리가 세 번 나옵니다. 그중 <b>가장 작게 들리는 소리</b>가 몇 번째였는지 고르세요.</p>
    <p>소리는 한 번씩만 나오니 집중해서 들어 주세요. 모두 6문제입니다.</p>`),
  choices: ['시작'],
};
const hpTrials = HP.map((h, i) => ({
  type: jsPsychHtmlButtonResponse,
  stimulus: page(`<h3>이어폰 확인 ${i + 1} / 6</h3><p id="hpmsg">듣는 중…</p><p>가장 작게 들린 소리는 몇 번째인가요?</p>`),
  choices: ['첫 번째', '두 번째', '세 번째'],
  data: { task: 'hp', answer: h.answer },
  on_load: () => {
    const btns = document.querySelectorAll('#jspsych-html-button-response-btngroup .jspsych-btn');
    btns.forEach((b) => (b.disabled = true));
    setTimeout(() => play(h.file, { onended: () => {
      btns.forEach((b) => (b.disabled = false)); document.getElementById('hpmsg').textContent = '이제 고르세요.';
    } }), 400);
  },
  on_finish: (d) => { d.correct = (d.response + 1 === h.answer) ? 1 : 0; hpScore += d.correct; },
}));
const hpFail = {
  timeline: [{
    type: jsPsychHtmlButtonResponse,
    stimulus: page(`<h3>참여해 주셔서 감사합니다</h3><p>이어폰 확인을 통과하지 못해 실험을 여기서 마칩니다.
      스피커로 듣고 있었다면 이어폰·헤드폰을 착용한 뒤 새 창에서 다시 시도할 수 있습니다.</p>`),
    choices: ['종료'],
    on_finish: async () => { P.status = 'hp_fail'; await save(); jsPsych.abortExperiment(page('<p>창을 닫으셔도 됩니다.</p>')); },
  }],
  conditional_function: () => { P.hp_score = hpScore; P.hp_pass = hpScore >= HP_PASS ? 1 : 0; return !P.hp_pass; },
};

/* ---------------- 6. 평가 안내 ---------------- */
const instr = {
  type: jsPsychHtmlButtonResponse,
  stimulus: page(`
    <h3>이렇게 진행됩니다</h3>
    <p><b>상황:</b> 편의점 계산대에서 휴대폰 간편결제를 했고, 화면에 "결제 완료"가 뜨면서 소리가 났습니다.</p>
    <p>소리는 자동으로 한 번 재생되고, 필요하면 <b>${MAX_REPLAYS}번까지 다시 들을 수 있습니다</b>. 소리를 듣고 아래 문항에 답해 주세요.</p>
    <ul><li>앞의 2문항: 문장에 얼마나 동의하는지 (1 전혀 그렇지 않다 ~ 7 매우 그렇다)</li>
        <li>뒤의 문항: 양쪽 단어 중 소리가 어느 쪽에 가까운지 (가운데 4는 어느 쪽도 아님)</li></ul>
    <p>실제 앱보다 단순한 소리들입니다. 소리끼리 <b>비교하면서</b>, 상대적으로 더 믿음이 가면 높게, 덜하면 낮게 <b>1~7점을 고루</b> 써 주세요.</p>
    <p>정답은 없습니다. 생각나는 대로 빠르게 답해 주세요. 먼저 연습을 한 번 합니다.</p>`),
  choices: ['연습 시작'],
};

/* ---------------- 7. 평가 시행 ---------------- */
let plays = 0;
function rateTrial(s, opts) {
  const { practice = 0, attn = false, label = '' } = opts;
  const targets = TARGET_ITEMS.map((it) => `
    <div class="row lik"><div class="stem">${it.text}</div><div class="pts">${scale7(it.id)}</div></div>`).join('');
  const sds = SD_ITEMS.map((it) => `
    <div class="row sd"><div class="l">${it.left}</div><div class="pts">${scale7(it.id)}</div><div class="r">${it.right}</div></div>`).join('');
  const attnRow = attn ? `
    <div class="row lik"><div class="stem">주의 확인: 이 줄에서는 <b>5</b>를 선택해 주세요</div><div class="pts">${scale7('ATTN')}</div></div>` : '';
  return {
    type: jsPsychSurveyHtmlForm,
    preamble: page(`<div class="tag">${label}</div>
      <div class="ctx"><img src="pay_done.svg" alt="결제 완료 화면">
        <div><button type="button" id="replay" class="jspsych-btn" disabled>다시 듣기</button>
        <div id="pc" class="muted"></div></div></div>`),
    html: `<div class="page form">
      <div class="hdr"><span></span><span class="ends"><i>전혀 그렇지 않다</i><i>매우 그렇다</i></span></div>${targets}
      <hr><div class="hdr sdh"><span></span><span class="ends"><i>1</i><i>4</i><i>7</i></span></div>${sds}${attnRow}</div>`,
    button_label: '다음',
    data: { task: practice ? 'practice' : 'rate', ...s },
    on_load: () => {
      plays = 0;
      const sub = document.getElementById('jspsych-survey-html-form-next'); sub.disabled = true;
      const rb = document.getElementById('replay'); const pc = document.getElementById('pc');
      const go = () => {
        plays++; rb.disabled = true; pc.textContent = '재생 중…';
        play(s.file, { onended: () => {
          sub.disabled = false;
          const left = MAX_REPLAYS + 1 - plays;
          rb.disabled = left <= 0; pc.textContent = left > 0 ? `다시 듣기 ${left}번 남음` : '다시 듣기를 모두 사용했어요';
        } });
      };
      rb.onclick = go;
      setTimeout(go, 600);
    },
    on_finish: (d) => {
      stopAudio();
      Object.assign(d, d.response); d.plays = plays;
      if (attn) d.attn_ok = d.ATTN === '5' ? 1 : 0;
      if (!practice) {
        const row = { pid: PID, order: TRIALS.length + 1, stim: s.stim, prog: s.prog, timbre: s.timbre, len: s.len,
                      is_ref: s.is_ref, plays, rt: d.rt };
        TARGET_ITEMS.concat(SD_ITEMS).forEach((it) => (row[it.id] = Number(d.response[it.id])));
        row.attn = attn ? Number(d.ATTN) : '';
        TRIALS.push(row);
      }
    },
  };
}
const practice = [
  rateTrial({ file: 'practice2.wav', stim: 'practice', prog: '', timbre: '', len: '', is_ref: 0 }, { practice: 1, label: '연습' }),
];
const startMain = {
  type: jsPsychHtmlButtonResponse,
  stimulus: page(`<h3>이제 본 평가입니다</h3><p>소리 ${SYN.length + REF.length}개를 하나씩 평가합니다. 중간에 한 번 쉬는 시간이 있습니다.</p>`),
  choices: ['시작'],
};
const order = jsPsych.randomization.shuffle([...SYN, ...REF]);
const N = order.length;
const half = Math.ceil(N / 2);
const main = [];
order.forEach((s, i) => {
  main.push(rateTrial(s, { attn: ATTN_TRIALS.includes(i + 1), label: `${i + 1} / ${N}` }));
  if (i + 1 === half) main.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: page(`<h3>잠깐 쉬어 가세요</h3><p>절반을 마쳤습니다. 준비되면 이어서 진행해 주세요. <b>볼륨은 그대로</b> 두세요.</p>`),
    choices: ['계속'],
  });
});

/* ---------------- 8. 사후 질문: 높게 평가한 소리 3개 다시 듣고 고르기 ---------------- */
let TOP3 = [];
const post = {
  type: jsPsychSurveyHtmlForm,
  html: () => {
    const score = (t) => TARGET_ITEMS.reduce((s, it) => s + (t[it.id] || 0), 0);
    TOP3 = jsPsych.randomization.shuffle(TRIALS.slice())          // 동점은 무작위
      .sort((a, b) => score(b) - score(a)).slice(0, 3).map((t) => t.stim);
    const opts = TOP3.map((s, i) => `
      <div class="pick"><button type="button" class="jspsych-btn" data-i="${i}">▶ 소리 ${'ABC'[i]}</button>
        <label><input type="radio" name="best" value="${s}" required> 이 소리</label></div>`).join('');
    return page(`
      <h3>마지막 질문</h3>
      <p>아래는 방금 <b>가장 믿음이 간다고 평가한 소리 3개</b>입니다. 다시 들어 보고 그중 <b>하나</b>를 골라 주세요.</p>
      <div class="picks">${opts}</div>
      <div class="q">그 소리를 고른 이유를 한 줄로 적어 주세요.<br><input type="text" name="best_reason" required maxlength="200" class="oneline"></div>
      <div class="q">실험 도중 볼륨을 바꾸셨나요?
        <select name="vol_changed" required><option value="">선택</option><option value="no">아니요</option><option value="yes">예</option></select></div>
      <div class="q">주변 환경은 어땠나요?
        <select name="env" required><option value="">선택</option><option value="quiet">조용했다</option><option value="some">약간 소음이 있었다</option><option value="noisy">시끄러웠다</option></select></div>`);
  },
  button_label: '제출',
  on_load: () => {
    document.querySelectorAll('.pick button').forEach((b) => {
      b.onclick = () => play(TOP3[Number(b.dataset.i)] + '.wav');
    });
  },
  on_finish: (d) => {
    stopAudio();
    Object.assign(P, d.response);
    P.worst = TOP3.join(',');   // 시트의 worst 열 = 다시 들려준 상위 3개 (분석에서 top3로 읽음)
  },
};

/* ---------------- 9. 저장 ---------------- */
async function save() {
  P.end = new Date().toISOString();
  P.minutes = Math.round((new Date() - START) / 600) / 100;
  P.n_trials = TRIALS.length;
  P.attn_pass = TRIALS.filter((t) => t.attn !== '').every((t) => t.attn === 5) ? 1 : 0;
  const payload = JSON.stringify({ participant: P, trials: TRIALS });
  try { localStorage.setItem('payexp_' + PID, payload); } catch (e) {}
  if (!SHEET_URL) { console.log('[테스트 모드] 저장 생략', JSON.parse(payload)); return true; }
  for (let k = 0; k < 3; k++) {
    try {
      const r = await fetch(SHEET_URL, { method: 'POST', body: payload });
      const j = await r.json();
      if (j.ok) return true;
    } catch (e) { await new Promise((res) => setTimeout(res, 1500)); }
  }
  return false;
}
const saving = {
  type: jsPsychHtmlButtonResponse,
  stimulus: page(`<h3>응답을 저장하는 중입니다…</h3><p id="sv">잠시만 기다려 주세요. 창을 닫지 마세요.</p>`),
  choices: ['완료'],
  on_load: () => {
    const b = document.querySelector('.jspsych-btn'); b.disabled = true;
    P.status = 'complete';
    save().then((ok) => {
      const el = document.getElementById('sv');
      if (ok) {
        el.innerHTML = `저장되었습니다. 참여해 주셔서 감사합니다!<br><br>참여 코드: <b class="code">${PID}</b>`;
      } else {
        const blob = new Blob([JSON.stringify({ participant: P, trials: TRIALS })], { type: 'application/json' });
        el.innerHTML = `<span class="err">서버 저장에 실패했습니다.</span><br>아래 파일을 내려받아 실험 담당자에게 보내 주세요.<br><br>
          <a class="jspsych-btn" download="payexp_${PID}.json" href="${URL.createObjectURL(blob)}">응답 파일 내려받기</a><br><br>참여 코드: <b class="code">${PID}</b>`;
      }
      b.disabled = false;
    });
  },
};
const bye = { type: jsPsychHtmlButtonResponse, stimulus: page('<h3>실험이 끝났습니다</h3><p>창을 닫으셔도 됩니다.</p>'), choices: [] };

jsPsych.run([consent, loading, demo, ineligible, calib, hpIntro, ...hpTrials, hpFail, instr, ...practice, startMain, ...main, post, saving, bye]);

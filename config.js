// ====== 실험 설정: 실험 전에 여기만 고치면 됩니다 ======

// 1) 구글 Apps Script 웹 앱 URL (배포 후 받은 주소를 붙여 넣기). 비워 두면 저장 없이 테스트 모드.
const SHEET_URL = '';

// 2) 실제 결제 앱 완료음(참조 자극). 파일을 stimuli/ 폴더에 넣고 이름을 적는다.
//    빈 배열이면 합성 자극 18개만 진행한다.
const REFS = [
  // { file: 'ref1.wav', app: 'A앱' },
  // { file: 'ref2.wav', app: 'B앱' },
  // { file: 'ref3.wav', app: 'C앱' },
];

// 3) 목표 감성 문항 (1 = 전혀 그렇지 않다, 7 = 매우 그렇다)
const TARGET_ITEMS = [
  { id: 'T1', text: '이 소리를 들으니 믿음이 간다' },
  { id: 'T3', text: '결제가 확실히 끝난 느낌이다' },
];

// 4) 하위 감성 SD 문항 6개 (왼쪽 = 1, 오른쪽 = 7). id는 예비보고서 번호를 유지(S3, S8 제외).
//    방향을 섞어 두어 한쪽으로만 찍는 응답을 줄인다. 분석 때 positive 쪽이 높도록 다시 코딩한다.
const SD_ITEMS = [
  { id: 'S1', left: '또렷한',   right: '흐릿한',     positive: 'left'  },
  { id: 'S2', left: '불안정한', right: '안정적인',   positive: 'right' },
  { id: 'S4', left: '둔한',     right: '경쾌한',     positive: 'right' },
  { id: 'S5', left: '부드러운', right: '날카로운',   positive: 'left'  },
  { id: 'S6', left: '저렴한',   right: '고급스러운', positive: 'right' },
  { id: 'S7', left: '차분한',   right: '다급한',     positive: 'left'  },
];

// 5) 기타
const MAX_REPLAYS = 3;            // 첫 재생(자동) 뒤 다시 듣기 최대 횟수
const ATTN_TRIALS = [6, 16];      // 주의 확인 문항을 넣을 본 시행 번호(1부터)
const HP_PASS = 5;                // 헤드폰 확인 6문항 중 통과 기준

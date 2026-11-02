/**
 * 문맥 추론 점검 모형 · 웹뷰어 설정 (이 파일만 고치면 됩니다)
 *
 * API_URL     : gas/Code.gs 를 웹 앱으로 배포한 주소(/exec 로 끝남).
 *               비워 두면 앱 2·3은 "이 기기에만 저장" 모드로 돌아가요(미리보기용).
 * APP1_URL    : 앱 1(BoW) HTML 주소. 현재 저장소의 apps/app1.html을 사용합니다.
 * PSEUDONYMIZE: true 이면 학교명을 시트에 보내기 전에 'S-xxxxxx' 가명 코드로 바꿔 보냅니다.
 *               (같은 학교명은 늘 같은 코드가 되어 우리 반 투표는 그대로 모여요)
 */
window.APP_CONFIG = {
  API_URL:
    "https://script.google.com/macros/s/AKfycbySPojMlh4vz-DUFCemO4HaxiFHsPq_rOYNn26nBNXrJmeFIQZPYKEZVQMmBIzAK-wu/exec",
  APP1_URL: "apps/app1.html",
  APP2_URL: "apps/app2.html",
  APP3_URL: "apps/app3.html",

  PSEUDONYMIZE: true,
};

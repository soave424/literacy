/**
 * 문맥 추론 점검 모형 · 웹뷰어 설정 (이 파일만 고치면 됩니다)
 *
 * API_URL     : gas/Code.gs 를 웹 앱으로 배포한 주소(/exec 로 끝남).
 *               비워 두면 앱 2·3은 "이 기기에만 저장" 모드로 돌아가요(미리보기용).
 * APP1_URL    : 앱 1(BoW) 주소. 앱 1의 HTML을 apps/app1.html 로 올리면 "apps/app1.html" 로 바꾸세요.
 *               지금은 기존 Apps Script 배포 주소를 씁니다. (배포 시 액세스: '모든 사용자' 여야 학생 화면에 보여요)
 * PSEUDONYMIZE: true 이면 학교명을 시트에 보내기 전에 'S-xxxxxx' 가명 코드로 바꿔 보냅니다.
 *               (같은 학교명은 늘 같은 코드가 되어 우리 반 투표는 그대로 모여요)
 */
window.APP_CONFIG = {
  API_URL:
    "https://script.google.com/macros/s/AKfycbzV_uJQOujfRwVNrsLPCd33MIRMSDxUYq1qEDwtvhoqMtBJPjQzGzRSHFOJxvIvbpRu/exec",
  APP1_URL:
    "https://script.google.com/macros/s/AKfycbwonTsozlg9xBYKQUb7SZNHO-dlHZQsxF_mYyCzLjeXpsF1JrZ-btfZtKrnLYDqsoyNkw/exec",
  PSEUDONYMIZE: true,
};

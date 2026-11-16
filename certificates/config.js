window.APP_CONFIG = {
  /* Same server as Akhnaton Devices: same people, same PINs, same company list */
  API_URL: 'https://script.google.com/macros/s/AKfycbwAtZNscKzNG1TrpnAMZvc-FUdC3WuwG2e9ywJYDyxDRutc0wT4yx18joHsRVQJW903Sw/exec',
  /* Files server: reads the copy of the SharePoint folder on Google Drive (Apps Script web app URL) */
  FILES_URL: '',
  /* Microsoft sign-in for SharePoint – paste the "Application (client) ID" from Microsoft Entra here */
  MS_CLIENT_ID: '',
  MS_TENANT: 'organizations',
  /* Where the calibration files live */
  SP_SITE_URL: 'https://evapharma.sharepoint.com/sites/CalibrationValidationTeam2',
  CERT_PATH: 'General/Certificates',
  /* Online datasheet search (Google Apps Script + Gemini with Google Search) – see server/Datasheets.gs */
  /* Shared jobs (Google Apps Script – see server/Jobs.gs): every job open for the whole team, with its history */
  JOBS_URL: 'https://script.google.com/macros/s/AKfycbwAWqCIdzkfieM2Qd_H4ilI6ZFh1bY5LdND5J6Dh5LnZOAjosB1ZrjBgonkWYsQfdM33w/exec',
  JOBS_KEY: 'akhnaton-jobs-2026',
  DS_URL: 'https://script.google.com/macros/s/AKfycbxpCz8VLbiu3Dy7K3nS0GrB3CwqzbpXcsjq_vFMII1qnzciErBnXGa4CgNtz4rNj-ydYg/exec',
  DS_KEY: 'akhnaton2026'
};

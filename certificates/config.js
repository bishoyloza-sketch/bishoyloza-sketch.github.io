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
  DS_URL: '',
  DS_KEY: ''
};

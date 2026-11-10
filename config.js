// ---------------------------------------------------------------------------
// Study configuration. This is the only file you normally need to edit.
// ---------------------------------------------------------------------------
window.STUDY_CONFIG = {
  // Google Apps Script web-app URL (see README.md, step 2).
  // While this is empty, results are NOT uploaded; participants only get the
  // "download my results" button. Useful for local testing.
  ENDPOINT_URL: "https://script.google.com/macros/s/AKfycbzPX9rEdI3mJWvNeF1inb2qTdjE2nzmAxe2hC_7VwLDA6UgiWnf4nsJG2-8RFfvUIeudQ/exec",

  // Change this whenever you change the stimuli, so data from different
  // versions can be told apart (it is stored with every row).
  STUDY_ID: "matbook_3d_v1",

  // Shown above the images on every trial (the material prompt is shown too).
  QUESTION:
    "Which object better shows the material of the sphere in the middle?",

  // Show the material text prompt under the question (the MATLAB version did).
  SHOW_PROMPT: true,

  // Gray screen between trials, in milliseconds (0.5 s in the MATLAB version).
  ISI_MS: 500,

  // Number of practice trials before the study (0 = none, go straight to the study).
  N_PRACTICE: 0,

  // Shown on the consent page. Leave empty to hide.
  CONTACT: "",
};

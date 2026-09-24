// ---- Element references ------------------------------------------------
const form = document.getElementById('profile-form');
const saveButton = document.getElementById('save-button');
const saveStatus = document.getElementById('save-status');
const saveError = document.getElementById('save-error');
const loadError = document.getElementById('load-error');

const fields = {
  displayName: document.getElementById('displayName'),
  bio: document.getElementById('bio'),
  linkLabel: document.getElementById('linkLabel'),
  linkUrl: document.getElementById('linkUrl'),
};

const preview = {
  name: document.getElementById('preview-name'),
  bio: document.getElementById('preview-bio'),
  linkWrap: document.getElementById('preview-link-wrap'),
  link: document.getElementById('preview-link'),
};

// ---- Helpers -----------------------------------------------------------

function clearBanner(el) {
  el.hidden = true;
  el.textContent = '';
}

function showBanner(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function clearFieldErrors() {
  for (const key of Object.keys(fields)) {
    const errEl = document.getElementById(`${key}-error`);
    errEl.hidden = true;
    errEl.textContent = '';
    fields[key].removeAttribute('aria-invalid');
  }
}

function showFieldError(key, message) {
  const errEl = document.getElementById(`${key}-error`);
  if (!errEl) return;
  errEl.textContent = message;
  errEl.hidden = false;
  const input = fields[key];
  if (input) input.setAttribute('aria-invalid', 'true');
}

function getFormValues() {
  return {
    displayName: fields.displayName.value,
    bio: fields.bio.value,
    linkLabel: fields.linkLabel.value,
    linkUrl: fields.linkUrl.value,
  };
}

function setFormValues(profile) {
  fields.displayName.value = profile.displayName ?? '';
  fields.bio.value = profile.bio ?? '';
  fields.linkLabel.value = profile.link?.label ?? '';
  fields.linkUrl.value = profile.link?.url ?? '';
}

// Mirrors server-side URL rule for preview only.
function isValidHttpsUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return false;
    if (!u.hostname) return false;
    if (!/^[a-z0-9.-]+$/i.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ---- Preview rendering -------------------------------------------------
// Entered text is treated as plain text (textContent, not innerHTML).
function renderPreview() {
  const v = getFormValues();

  preview.name.textContent = v.displayName.trim() || '—';
  preview.bio.textContent = v.bio.trim();

  const label = v.linkLabel.trim();
  const url = v.linkUrl.trim();

  if (label && isValidHttpsUrl(url)) {
    preview.link.textContent = label;
    preview.link.href = url;
    preview.link.classList.remove('is-invalid');
    preview.link.removeAttribute('aria-disabled');
    preview.link.removeAttribute('tabindex');
  } else {
    // Invalid URL must not be a working link.
    preview.link.textContent = label || '—';
    preview.link.removeAttribute('href');
    preview.link.classList.add('is-invalid');
    preview.link.setAttribute('aria-disabled', 'true');
    preview.link.setAttribute('tabindex', '-1');
  }
}

// ---- Load --------------------------------------------------------------
async function loadProfile() {
  clearBanner(loadError);
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) throw new Error(`Load failed (${res.status})`);
    const profile = await res.json();
    setFormValues(profile);
    renderPreview();
  } catch (err) {
    showBanner(loadError, 'Could not load the profile. Please refresh the page.');
    console.error(err);
  }
}

// ---- Save --------------------------------------------------------------
let saving = false;

async function saveProfile(event) {
  event.preventDefault();
  if (saving) return;

  clearBanner(saveError);
  clearFieldErrors();
  saveStatus.textContent = '';

  const v = getFormValues();

  // Client-side validation mirrors server for quick feedback.
  const clientErrors = {};
  const dName = v.displayName.trim();
  const bio = v.bio.trim();
  const lLabel = v.linkLabel.trim();
  const lUrl = v.linkUrl.trim();

  if (dName.length < 1 || dName.length > 40)
    clientErrors.displayName = 'Display name must be 1–40 characters.';
  if (bio.length > 160)
    clientErrors.bio = 'Bio must be 0–160 characters.';
  if (lLabel.length < 1 || lLabel.length > 30)
    clientErrors.linkLabel = 'Link label must be 1–30 characters.';
  if (!isValidHttpsUrl(lUrl))
    clientErrors.linkUrl = 'Link URL must be an absolute https:// URL with a hostname.';

  if (Object.keys(clientErrors).length > 0) {
    for (const [k, msg] of Object.entries(clientErrors)) showFieldError(k, msg);
    saveStatus.textContent = 'Please fix the errors above.';
    return;
  }

  const payload = {
    displayName: dName,
    bio,
    link: { label: lLabel, url: lUrl },
  };

  saving = true;
  saveButton.disabled = true;
  saveStatus.textContent = 'Saving…';

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      const details = body.details || {};
      for (const [key, msg] of Object.entries(details)) {
        const mapKey =
          key === 'link.label' ? 'linkLabel'
          : key === 'link.url' ? 'linkUrl'
          : key;
        if (fields[mapKey]) showFieldError(mapKey, msg);
        else showBanner(saveError, msg);
      }
      saveStatus.textContent = '';
      return;
    }

    if (!res.ok) throw new Error(`Save failed (${res.status})`);

    const saved = await res.json();
    setFormValues(saved);
    renderPreview();
    saveStatus.textContent = 'Saved.';
    saveStatus.classList.add('status--success');
    setTimeout(() => {
      saveStatus.classList.remove('status--success');
      if (saveStatus.textContent === 'Saved.') saveStatus.textContent = '';
    }, 2500);
  } catch (err) {
    // Keep form entries intact so user can retry.
    showBanner(saveError, 'Could not save. Your changes are still in the form — please retry.');
    saveStatus.textContent = '';
    console.error(err);
  } finally {
    saving = false;
    saveButton.disabled = false;
  }
}

// ---- Wiring ------------------------------------------------------------
form.addEventListener('submit', saveProfile);

for (const input of Object.values(fields)) {
  input.addEventListener('input', () => {
    renderPreview();
    // Clear per-field error as soon as the user edits.
    const key = input.id;
    const errEl = document.getElementById(`${key}-error`);
    if (errEl && !errEl.hidden) {
      errEl.hidden = true;
      errEl.textContent = '';
      input.removeAttribute('aria-invalid');
    }
  });
}

loadProfile();
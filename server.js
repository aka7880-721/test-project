const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- In-memory store ---------------------------------------------------
// Server memory is sufficient per the exercise; data loss on restart is OK.
let profile = {
  displayName: 'Nova',
  bio: 'Music, late nights, and things I make.',
  link: {
    label: 'My website',
    url: 'https://example.com',
  },
};

// ---- Middleware --------------------------------------------------------
app.use(express.json({ limit: '16kb' }));

// Serve the static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// ---- Validation --------------------------------------------------------
/**
 * Validate and normalize a profile payload.
 * Returns { ok: true, value } or { ok: false, errors }.
 * `errors` is an object keyed by field name -> message.
 */
function validateProfile(input) {
  const errors = {};

  // Top-level shape check
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: { _: 'Request body must be a JSON object.' } };
  }

  const { displayName, bio, link } = input;

  // All four values must be strings
  if (typeof displayName !== 'string') {
    errors.displayName = 'Display name is required and must be a string.';
  }
  if (typeof bio !== 'string') {
    errors.bio = 'Bio must be a string (it may be empty).';
  }
  if (link === null || typeof link !== 'object' || Array.isArray(link)) {
    errors.link = 'Link must be an object with "label" and "url".';
  } else {
    if (typeof link.label !== 'string') {
      errors['link.label'] = 'Link label is required and must be a string.';
    }
    if (typeof link.url !== 'string') {
      errors['link.url'] = 'Link URL is required and must be a string.';
    }
  }

  // If basic types are wrong, stop here — avoid a cascade of misleading errors.
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // Trim before checking lengths and saving
  const trimmed = {
    displayName: displayName.trim(),
    bio: bio.trim(),
    link: {
      label: link.label.trim(),
      url: link.url.trim(),
    },
  };

  // Length checks (using JS string-length convention: UTF-16 code units)
  if (trimmed.displayName.length < 1 || trimmed.displayName.length > 40) {
    errors.displayName = 'Display name must be 1–40 characters after trimming.';
  }
  if (trimmed.bio.length > 160) {
    errors.bio = 'Bio must be 0–160 characters after trimming.';
  }
  if (trimmed.link.label.length < 1 || trimmed.link.label.length > 30) {
    errors['link.label'] = 'Link label must be 1–30 characters after trimming.';
  }

  // URL check: absolute https:// with a hostname
  if (!isValidHttpsUrl(trimmed.link.url)) {
    errors['link.url'] =
      'Link URL must be an absolute https:// URL with a hostname.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: trimmed };
}

function isValidHttpsUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (!parsed.hostname) return false;
  // Hostname must look like a real host (letters/digits/dots/hyphens).
  if (!/^[a-z0-9.-]+$/i.test(parsed.hostname)) return false;
  return true;
}

// ---- Routes ------------------------------------------------------------

// GET current profile
app.get('/api/profile', (req, res) => {
  res.status(200).json(profile);
});

// PUT updated profile
app.put('/api/profile', (req, res) => {
  const result = validateProfile(req.body);
  if (!result.ok) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.errors,
    });
  }
  profile = result.value;
  res.status(200).json(profile);
});

// ---- Error handling ----------------------------------------------------

// Malformed JSON -> 400 instead of crashing
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Malformed JSON',
      details: { _: 'Request body could not be parsed as JSON.' },
    });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(400).json({
      error: 'Payload too large',
      details: { _: 'Request body exceeds the size limit.' },
    });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Start -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`misa profile editor listening on http://localhost:${PORT}`);
});
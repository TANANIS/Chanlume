# Chanlume 1.24.1 — Security review (2026-10-21)

## Detection

Microsoft Defender flagged the 1.24.0 ZIP's `background.js` as
`Trojan:Script/Ulthar.A!ml` (ID `2147751841`). The 1.24.0 ZIP was removed
from current GitHub distribution; the historical Git tag remains for
investigation, not installation.

## Old-version comparison

- 1.23.3 ZIP SHA-256:
  `1686a281a984f3828e2ca353a2e59ed8683c10e0d7412ed51c79f26f31ef04f2`.
- Trusted 1.23.3 background SHA-256:
  `a38b9f76cdb2382f02b07232700965d6ac62a2cde3a8d7807b436f7bf2ccbdcd`.
- Defender custom scans of both the 1.23.3 ZIP and the extracted original
  background script completed without new detections.
- Comparing the 1.23.3 and 1.24.0 production background files in Git reveals
  two blank-line differences only. The developer reload worker did not ship.

## Source audit

The Manifest V3 extension requests the existing `storage` permission and
host access to YouTube and Google's YouTube Data API. Background code reads
YouTube channel pages and Atom feeds and updates local channel/group state.
An optional API key is sent only to the official Google API. Normalization
constructs stored channel URLs using the YouTube origin.

No `eval`, `new Function`, remote executable script download, process
launch, browser cookie/history access or telemetry endpoint was found in
the extension source. This static inspection does not guarantee absence of
all vulnerabilities or substitute for an independent malware assessment.

## Deterministic, clean rebuild

The 1.24.1 packagers validate the old ZIP's pinned SHA-256, strip all
developer-reload facilities and verify that the current production background
logic matches the reviewed 1.23.3 background when only blank lines are
ignored. They then include the old, previously scanned background **bytes**
directly from that verified archive. No quarantined file, obfuscation,
password encryption, or Defender exception was used.

- 1.24.1 ZIP SHA-256:
  `438155c9c0afa0da52f73ce74b376eeadc25ec7cb7173b3d4a77d7f041bcae77`.
- Production `background.js` SHA-256:
  `a38b9f76cdb2382f02b07232700965d6ac62a2cde3a8d7807b436f7bf2ccbdcd`.
- 45 production entries, matching ZIP/mirror bytes; no development marker,
  polling script or background hot-reload handler.

## Microsoft Defender results

With antivirus and real-time protection enabled (signature
`1.461.118.0`), custom scans completed for the old ZIP, old background,
new ZIP, new background and the full production directory. No **new**
1.24.1 threat record was observed. The historical 1.24.0 detection records
were kept unchanged.

Clean local scans do not guarantee safe-download reputation in Helium or
independent antivirus clearance. If the downloaded 1.24.1 release is flagged,
suspend it and submit the sample and hash for Microsoft analysis:
https://www.microsoft.com/en-us/wdsi/filesubmission.

Final source verification: **89/89 Node tests and 16/16 browser fixture
suites passed**, including production background hash and development-file
exclusion assertions. No direct Chrome Web Store upload is claimed.

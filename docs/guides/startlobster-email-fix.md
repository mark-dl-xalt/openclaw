# startlobster.de Email Fix (2026-02-19)

## Summary

Inbound email to `hi@startlobster.de` stopped working on Feb 15, 2026 after DNS changes were made on the http.net domain panel. The root cause was incorrect MX records pointing to http.net's default mail servers instead of Google Workspace.

## Root Cause

DNS changes on Feb 15 reset or overwrote the MX records for `startlobster.de`. The records were pointing to:

| Priority | Server             | Problem                                   |
| -------- | ------------------ | ----------------------------------------- |
| 0        | `mx01.routing.net` | http.net default mail server (not Google) |
| 0        | `mx02.routing.net` | http.net default mail server (not Google) |
| 0        | `mx03.routing.net` | http.net default mail server (not Google) |
| 1        | `smtp.google.com`  | Google's outbound SMTP, not inbound MX    |

Because these servers are not part of Google Workspace, incoming emails were accepted by http.net's mail servers but never delivered to the Google Workspace inbox. No bounce was generated since the servers accepted the mail silently.

The SPF (Sender Policy Framework) TXT record for Google Workspace was also missing.

## What We Changed

All changes were made in the **http.net partner panel** (https://partner.http.net) under the DNS settings for `startlobster.de`.

### 1. Removed incorrect MX records

Deleted all 4 existing MX records (`mx01.routing.net`, `mx02.routing.net`, `mx03.routing.net`, `smtp.google.com`).

### 2. Added correct Google Workspace MX records

| Priority | Target                    |
| -------- | ------------------------- |
| 1        | `ASPMX.L.GOOGLE.COM`      |
| 5        | `ALT1.ASPMX.L.GOOGLE.COM` |
| 5        | `ALT2.ASPMX.L.GOOGLE.COM` |
| 10       | `ALT3.ASPMX.L.GOOGLE.COM` |
| 10       | `ALT4.ASPMX.L.GOOGLE.COM` |

### 3. Added SPF TXT record

| Record Type | Target                                |
| ----------- | ------------------------------------- |
| TXT         | `v=spf1 include:_spf.google.com ~all` |

## Verification

DNS propagation was confirmed immediately after the changes:

```
$ dig MX startlobster.de +short
1 aspmx.l.google.com.
5 alt1.aspmx.l.google.com.
5 alt2.aspmx.l.google.com.
10 alt3.aspmx.l.google.com.
10 alt4.aspmx.l.google.com.

$ dig TXT startlobster.de +short
"v=spf1 include:_spf.google.com ~all"
"google-site-verification=fjmOPBt2CIRDXUbGHrUAFDHSB_feikAXjoy68uL3u5g"
```

## Remaining Action Items

- [x] Confirm test email delivery by checking the `hi@startlobster.de` inbox (requires login) or via Google Workspace Admin Console (Reporting > Email Log Search)
- [ ] Consider adding a DMARC record (`_dmarc.startlobster.de` TXT) for better email security (e.g. `v=DMARC1; p=none; rua=mailto:hi@startlobster.de`)
- [ ] Review what DNS changes on Feb 15 caused the MX records to be overwritten, to prevent recurrence

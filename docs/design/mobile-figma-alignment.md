# Mobile Figma alignment

Reference: user-supplied revised auth board (Login, Registration, Verify Email, Create Profile) and Ohun Figma Settings Hub node 6:4815.

This correction replaces the centered card/brand logo auth layout with the left-aligned blue wordmark, 24px page margins, 28px headings and 8px-radius form controls. Verification uses six visual boxes backed by one accessible autofill/paste input. Registration puts username first. Profile creation can stage a photo before saving and only shows username editing for an existing profile. Settings uses the profile card, grouped General/Advanced rows, and pale-red sign-out control.

Intentional functional differences: native sessions retain the approved native persistence policy, so there is no decorative Remember me checkbox. No Terms checkbox is added without available Terms/Privacy content and corresponding consent handling. Unimplemented settings are explicitly labelled Coming soon. Location/online indicators and invented company/location footer copy are omitted. Password visibility controls remain accessible.

Settings icons use the locally bundled Material Symbols Regular font from @expo-google-fonts/material-symbols 0.4.42, Apache 2.0, with license at docs/licenses/MaterialSymbols-LICENSE.txt. Figma PNG asset downloads timed out in this workspace; the font provides the corresponding Material glyphs. The bundled font is subset to the thirteen used glyphs with fontTools; the Apache license is retained. No runtime external font request or added npm dependency.

Validation: 31 mobile tests pass, including pasted verification codes and saving a staged photo. Mobile lint/typecheck and Android/iOS bundle exports pass. Browser screenshot comparison is blocked by ERR_BLOCKED_BY_CLIENT for the local preview. Native device appearance and screen-reader checks remain unverified.

Android screenshot follow-up: visibility controls now sit inside each password field; Forgot password is right-aligned. Auth POST requests have a 15-second deadline including response-body reading, abort on expiry, and never automatically retry registration. The registration timeout offers email verification recovery. This bounds a stalled UI but does not establish why the user's local API failed to respond.

Settings screenshot review (2026-10-11): user confirmed fresh-account registration, verification, sign-in and staged profile photo saving. Device screenshots show readable Settings content and loaded avatar. Matched decorative card borders (#edeef3) and avatar ring (#d6ddf7) to retrieved Figma values; removed chevrons from unavailable rows. The bundled outlined Material Symbols still differ from the filled Material Icons reference; exact icon parity and final updated device rendering remain unverified.

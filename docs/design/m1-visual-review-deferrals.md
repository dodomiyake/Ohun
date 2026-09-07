# M1 visual review — deferred findings

During the Milestone 1 visual and accessibility review of PR #1, the following items were classified as **P2** and are intentionally deferred. They are not merge blockers for the M1 foundation shells.

## B5 — Authentication shell design fidelity

**Finding:** The M1 auth shell is a simplified structural preview compared with the approved Stitch Login screen (for example: social sign-in buttons, “Forgot password?”, remember-me, and exact marketing copy are not reproduced).

**Why deferred:** Milestone 1 delivers static shells only. Functional authentication and a full design pass against every Stitch auth detail belong to a later milestone. The current shell still shows Ohun branding, centred readable layout, correct heading hierarchy, and disabled form controls.

**Follow-up:** Align auth presentation with the approved Stitch Login when authentication is implemented.

## B6 — Desktop shell at 320px width

**Finding:** The desktop three-panel route can overflow horizontally at 320px CSS width.

**Why deferred:** 320px reflow is required for the principal mobile/auth experience (verified). The desktop shell is not a target layout at that width; compact viewports are expected to use the mobile or tablet routes.

**Follow-up:** If a single responsive shell replaces route-based previews, ensure desktop chrome collapses or redirects below the desktop breakpoint without horizontal overflow.

## Reference

Approved design source: https://stitch.withgoogle.com/projects/16264346330507370332

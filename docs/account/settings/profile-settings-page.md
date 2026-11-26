# Profile Settings

This document describes the Profile tab of the settings dialog (`?settings=profile`, see [README.md](README.md)).

## Content

One form with a Save button. Save is disabled until something changed, and asks for the password before applying (see [Password confirmation](README.md#password-confirmation)). One prompt covers every change in that save.

| Field | Rules |
| ----- | ----- |
| Avatar | See [Avatar](#avatar). |
| Username | Same rules as the login: `USERNAME_CHARSET_PATTERN`, normalized to lowercase, unique. |
| Email | Valid email, unique. Changed directly, without a verification email, since the app sends no mail (Better Auth `changeEmail` with `updateEmailWithoutVerification: true`). |

- Invalid fields show inline errors; nothing is saved until every field is valid and the password is correct.
- After saving, the sidebar footer identity updates without a reload, and a toast says "Profile updated".

## Avatar

- Shows the current avatar, or the initials fallback (shadcn `avatar`). Buttons: "Change" and "Remove" (Remove only when an avatar is set).
- **Change**: pick a file (png, jpg, webp or avif, at most 2 MB), then a crop dialog opens:
  - square crop area, drag to move, slider or pinch to zoom
  - Cancel and Apply
- Apply renders the crop in the browser to a 512 × 512 WebP. The form shows it as a preview; it is uploaded only on Save.
- **Remove** clears the avatar on Save.
- On Save the server:
  - verifies the password,
  - checks the image is a WebP (by its bytes, not the declared type) and at most 2 MB,
  - writes it to R2 under the user's prefix (`userObjectKey(userId, ...)`) with `putObject`, in memory only,
  - stores the key in `user.image` (see [data-model.md](../../data-model.md#user)) and deletes the previous avatar object.
- **Checkbox** below the buttons: "Use Gravatar when I don't have an avatar image". Unchecked by default. Stored in `user.useGravatar` (see [data-model.md](../../data-model.md#user)) and saved with the rest of the form on Save.
  - Checked and no avatar uploaded: show the Gravatar image for the account email, `https://gravatar.com/avatar/<sha256 of the trimmed, lowercased email>?s=512&d=404`. If Gravatar has no image (404), fall back to the initials.
  - An uploaded avatar always wins over Gravatar.
  - The URL is built on the server and follows email changes.
  - Unchecked: the app never contacts Gravatar. Checked: the browser loads the image from gravatar.com, which sees your IP and a hash of your email.
- The avatar is shown through a presigned inline URL (`createDownloadUrl` with `filename: 'avatar.webp'`, allowed by the inline allowlist in [security.md](../../security/security.md#4-uploaded-htmlsvg-served-inline)). The URL is created on the server when the app layout loads and expires after 1 hour; never store the URL itself.

## Security section

At the bottom of the tab:

- Title: "Security"
- Description: "To change your password, use the button below."
- Button "Change password": switches the dialog to the Security tab (`?settings=security`).

## Acceptance criteria

- Changing username or email with the wrong password changes nothing.
- After changing the username, login works with the new username and not the old one.
- An avatar file larger than 2 MB, or not an image, is rejected before the crop dialog opens.
- After changing or removing the avatar, the old R2 object is gone.
- With the Gravatar checkbox unchecked, no request goes to gravatar.com.
- With it checked, no uploaded avatar, and no Gravatar for the email, the initials are shown.

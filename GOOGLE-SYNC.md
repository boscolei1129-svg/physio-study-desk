# Enable Google sync for Study Desk

The app uses [Google Identity Services' browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model) and [Google Drive's app data folder](https://developers.google.com/workspace/drive/api/guides/appdata). A Google Cloud project and public Web application OAuth client ID are required. Use an account that you control for this project.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project for Physio Study Desk.
2. [Enable the Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) for that project.
3. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), set up Branding and Audience. Use the name **Physio Study Desk**, the requested contact details and the appropriate audience. For a personal Google account in External testing, add your Google account in **Audience → Test users**. If Google asks for app links, the homepage is `https://boscolei1129-svg.github.io/physio-study-desk/` and the privacy page is `https://boscolei1129-svg.github.io/physio-study-desk/#privacy`.
4. In **Data Access**, add `https://www.googleapis.com/auth/drive.appdata`.
5. In **Clients**, create a **Web application** client and use `https://boscolei1129-svg.github.io` as an **Authorized JavaScript origin**. The origin has no path or trailing slash. Leave the redirect URI list empty for this popup flow.
6. Copy the **client ID** ending in `.apps.googleusercontent.com` and paste it in **More → Account & sync → Enter your Study Desk client ID**, or set `googleClientId` in `google-config.mjs` for all devices. The client ID is public. Keep the client secret out of the app and repository.
7. Sign in from a regular browser and approve access to Study Desk's Drive app data. Check for the **Synced to Google Drive** status. On a second device use the same client ID, site and Google account. A new device can load the cloud copy on the Account & sync page. If copies differ, review their timestamps and export this device's copy before choosing if you want both on hand.

The browser keeps a local copy for offline study. Google access lasts for the current page and expires periodically. Reopening or reloading the app requires sign-in before new edits can sync. The signed-in app checks the cloud about once a minute and attempts a sync after study saves. When a newer cloud copy arrives while you're studying, the footer directs you to Account & sync.

The save includes the records in a normal Study Desk backup. PDF diagrams are kept separately in this browser and can be transferred from Diagram practice using its export and import controls. Each cloud save appends a snapshot so concurrent edits can be detected. Older snapshots remain in Drive. Use **Google Drive → Settings → Manage Apps** if you want to remove app data from your account.

# Bug Report GitHub Integration - Setup Instructions

This document explains how to set up the GitHub integration for bug reports.

## Overview

When users click "Report a Bug" in the app and submit a description:
1. User can optionally upload a screenshot (drag & drop or click to select)
2. Screenshot is uploaded to Firebase Storage
3. A GitHub issue is automatically created in your repository (with embedded screenshot)
4. The bug report is stored in Firestore for tracking
5. The user sees a success message with the GitHub issue URL

## Setup Steps

### 1. Create a GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "CourtMaster Bug Reports"
4. Select scopes:
   - ✅ `repo` (to create issues in your repository)
   - ✅ `read:user` (optional, for user info)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)

### 2. Configure Environment Variables

Set these environment variables in your Firebase Functions:

```bash
# Using Firebase CLI
firebase functions:config:set github.token="ghp_YOUR_TOKEN_HERE"
firebase functions:config:set github.repo_owner="your-github-username"
firebase functions:config:set github.repo_name="courtmaster-v2"
```

**Or** using environment variables (for local development):

```bash
# .env file in functions/ directory
GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=courtmaster-v2
```

### 3. Deploy the Cloud Function

```bash
cd functions
npm run build
firebase deploy --only functions:submitBugReport
```

### 4. Create Firestore Collection

The `bugReports` collection will be created automatically when the first bug report is submitted.

**Security Rules** (add to `firestore.rules`):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... existing rules ...

    match /bugReports/{reportId} {
      allow read: if request.auth != null && request.auth.token.admin == true;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```

### 5. Configure Firebase Storage

The `storage.rules` file has been created with security rules for bug report screenshots.

**Deploy Storage Rules:**

```bash
firebase deploy --only storage
```

**Storage Security Rules** (`storage.rules`):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Bug report screenshots
    match /bug-reports/{userId}/{allPaths=**} {
      // Allow users to upload their own bug report screenshots
      allow create: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024  // Max 5MB
        && request.resource.contentType.matches('image/.*');

      // Allow anyone to read bug report screenshots (needed for GitHub issue embedding)
      allow read: if true;

      // Only admins can delete
      allow delete: if request.auth != null 
        && firestore.get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Testing

1. Open the app and click the bug icon in the header
2. Enter a test bug description
3. (Optional) Upload a screenshot:
   - Click the upload area to select an image
   - Or drag and drop an image file
   - Supported formats: JPEG, PNG, GIF, WebP (max 5MB)
4. Click "Submit Report"
5. Verify:
   - Success toast appears
   - Screenshot is uploaded to Firebase Storage
   - GitHub issue is created in your repository with embedded image
   - Bug report appears in Firestore `bugReports` collection

## Data Structure

### GitHub Issue Format

**Title:** `Bug Report: [first 80 chars of description]`

**Body:**
```markdown
## Bug Report

**Description:**
[User's full description]

**Reporter:** User Name (user@email.com)
**User ID:** [Firebase UID]
**Page URL:** [Current page URL]
**Browser:** [User agent string]
**Reported At:** [ISO timestamp]

**Screenshot:**
![Screenshot](https://firebasestorage.googleapis.com/...)

---
*This issue was automatically created from a user bug report.*
```

**Labels:** `bug`, `user-report`

### Firestore Document Schema

```typescript
{
  description: string;           // User's bug description
  pageUrl: string | null;        // Current page URL
  browserInfo: string | null;    // User agent string
  screenshotUrl: string | null;  // Firebase Storage URL of screenshot
  userId: string;                // Firebase Auth UID
  userEmail: string;             // User's email
  userName: string;              // User's display name
  githubIssueNumber: number;     // GitHub issue number
  githubIssueUrl: string;        // GitHub issue URL
  status: 'open' | 'closed';     // Issue status
  createdAt: Timestamp;          // Creation timestamp
}
```

## Troubleshooting

### "Bug reporting is not properly configured"

**Cause:** Environment variables not set

**Fix:** Run the `firebase functions:config:set` commands from Step 2

### GitHub API Error (401/403)

**Cause:** Invalid or expired token, or token lacks `repo` scope

**Fix:** 
1. Generate a new token with correct scopes
2. Update the config: `firebase functions:config:set github.token="new_token"`
3. Redeploy: `firebase deploy --only functions:submitBugReport`

### "User must be authenticated"

**Cause:** User not logged in

**Fix:** Ensure user is authenticated before showing the bug report button (already handled in UI)

### Issues not appearing in repository

**Cause:** Wrong repo owner/name in config

**Fix:** 
1. Check your repo URL: `https://github.com/OWNER/REPO`
2. Update config: 
   ```bash
   firebase functions:config:set github.repo_owner="OWNER"
   firebase functions:config:set github.repo_name="REPO"
   ```
3. Redeploy

### "Failed to upload screenshot" or image not showing in GitHub

**Cause 1:** Storage rules not deployed or incorrect

**Fix:**
```bash
firebase deploy --only storage
```

**Cause 2:** Storage bucket not configured

**Fix:** 
1. Go to Firebase Console → Storage
2. Click "Get Started" if not already enabled
3. Choose "Start in test mode" or configure rules as shown above
4. Note the bucket name and update your `.env` file:
   ```
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   ```

**Cause 3:** File too large or wrong format

**Fix:** Ensure file is:
- Less than 5MB
- JPEG, PNG, GIF, or WebP format

## Security Considerations

1. **Token Security:** The GitHub token is stored in Firebase Functions config, not in code
2. **Rate Limiting:** GitHub API has rate limits (5000 requests/hour for authenticated users)
3. **Input Validation:** Bug descriptions are limited to 5000 characters
4. **Authentication:** Only authenticated users can submit bug reports
5. **Data Privacy:** User email and ID are included in GitHub issues - ensure your repo is private if needed

## Customization

### Change Labels

Edit `functions/src/bugReport.ts` line 92:
```typescript
labels: ['bug', 'user-report', 'triage'],  // Add your custom labels
```

### Add Additional Metadata

Edit the `body` template in `functions/src/bugReport.ts` to include more context like:
- Tournament ID (if on tournament page)
- Error logs from console
- User role (admin, organizer, etc.)

### Change Screenshot File Size Limit

**Frontend** (`src/components/layout/AppLayout.vue`):
```typescript
const maxFileSize = 10 * 1024 * 1024; // Change from 5MB to 10MB
```

**Storage Rules** (`storage.rules`):
```
allow create: if isAuthenticated()
  && request.auth.uid == userId
  && request.resource.size < 10 * 1024 * 1024  // Change to 10MB
  && request.resource.contentType.matches('image/.*');
```

### Auto-Assign Issues

Add to the GitHub API call in `functions/src/bugReport.ts`:
```typescript
body: JSON.stringify({
  title,
  body,
  labels: ['bug', 'user-report'],
  assignees: ['your-github-username'],  // Auto-assign to someone
}),
```

## Files Modified

| File | Change |
|------|--------|
| `functions/src/bugReport.ts` | **NEW** - Cloud Function to create GitHub issues |
| `functions/src/index.ts` | Export the new Cloud Function |
| `src/components/layout/AppLayout.vue` | Updated with screenshot upload UI and API integration |
| `src/services/firebase.ts` | Added Firebase Storage initialization and exports |
| `firestore.rules` | Added security rules for `bugReports` collection |
| `storage.rules` | **NEW** - Security rules for screenshot uploads |
| `firebase.json` | Added storage configuration and emulator |

## Next Steps

1. Set up the GitHub token and environment variables
2. Deploy Firestore security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
3. Deploy Storage security rules:
   ```bash
   firebase deploy --only storage
   ```
4. Deploy the Cloud Function:
   ```bash
   firebase deploy --only functions:submitBugReport
   ```
5. Test by submitting a bug report with a screenshot
6. Check that issues appear in your GitHub repository with embedded images
7. Monitor the `bugReports` collection in Firestore for tracking

---

## Quick Summary

✅ **What's Working Now:**
- Users can report bugs with rich descriptions
- Optional screenshot upload (drag & drop or click)
- Screenshots stored in Firebase Storage
- Automatic GitHub issue creation with embedded images
- Firestore tracking of all bug reports
- Full security with authentication and authorization

✅ **User Experience:**
- Click bug icon → Dialog opens
- Type description (required)
- Upload screenshot (optional, 5MB max)
- Submit → Success toast appears
- GitHub issue created automatically

✅ **Admin Experience:**
- View bug reports in GitHub with full context
- See screenshots embedded in issues
- Track all reports in Firestore `bugReports` collection
- Searchable and filterable bug history

**Questions?** Check the GitHub API documentation: https://docs.github.com/en/rest/issues/issues#create-an-issue

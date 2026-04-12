import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface BugReportData {
  description: string;
  pageUrl?: string;
  browserInfo?: string;
  screenshotUrl?: string;
}

function getGithubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repoOwner = process.env.GITHUB_REPO_OWNER;
  const repoName = process.env.GITHUB_REPO_NAME;

  return { token, repoOwner, repoName };
}

export const submitBugReport = functions.https.onCall(
  async (request: functions.https.CallableRequest<BugReportData>) => {
    const { description, pageUrl, browserInfo, screenshotUrl } = request.data;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Bug description is required'
      );
    }

    if (description.length > 5000) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Bug description is too long (max 5000 characters)'
      );
    }

    try {
      const db = admin.firestore();
      let userEmail = 'anonymous';
      let userName = 'Anonymous';

      if (request.auth?.uid) {
        const userDoc = await db.collection('users').doc(request.auth.uid).get();
        const userData = userDoc.data();
        userEmail = userData?.email || 'unknown';
        userName = userData?.displayName || 'Anonymous';
      }

      const { token, repoOwner, repoName } = getGithubConfig();

      if (!token || !repoOwner || !repoName) {
        console.error('GitHub configuration missing');
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Bug reporting is not properly configured. Please contact support.'
        );
      }

      const title = `Bug Report: ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`;

      let body = `## Bug Report

**Description:**
${description}

**Reporter:** ${userName} (${userEmail})
**User ID:** ${request.auth?.uid || 'anonymous'}
**Page URL:** ${pageUrl || 'Not provided'}
**Browser:** ${browserInfo || 'Not provided'}
**Reported At:** ${new Date().toISOString()}
`;

      if (screenshotUrl) {
        body += `\n**Screenshot:**\n![Screenshot](${screenshotUrl})\n`;
      }

      body += `\n---\n*This issue was automatically created from a user bug report.*\n`;

      const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/issues`;

      console.log('Creating GitHub issue:', { repoOwner, repoName, title: title.substring(0, 50) });

      const response = await fetch(githubApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          labels: ['bug', 'user-report'],
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('GitHub API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorData,
        });
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const issueData = await response.json() as { number: number; html_url: string };
      const issueNumber = issueData.number;
      const issueUrl = issueData.html_url;

      console.log('GitHub issue created:', { issueNumber, issueUrl });

      await db.collection('bugReports').add({
        description: description.trim(),
        pageUrl: pageUrl || null,
        browserInfo: browserInfo || null,
        screenshotUrl: screenshotUrl || null,
        userId: request.auth?.uid || null,
        userEmail,
        userName,
        githubIssueNumber: issueNumber,
        githubIssueUrl: issueUrl,
        status: 'open',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log('Bug report stored in Firestore');

      return {
        success: true,
        issueNumber,
        issueUrl,
        message: 'Bug report submitted successfully!',
      };

    } catch (error) {
      console.error('Error submitting bug report:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to submit bug report'
      );
    }
  }
);

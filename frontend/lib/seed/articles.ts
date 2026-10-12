/**
 * Seed article matching the north-star mock
 * (Docs/mocks/TechBase Windows Knowledge Article.png).
 *
 * Real IT content — no lorem ipsum.
 */

import type { Article } from "@/lib/types/article";

export const SEED_ARTICLES: Record<string, Article> = {
  "windows-11-resetting-local-administrator-password": {
    id: "KB-IT-1024",
    slug: "windows-11-resetting-local-administrator-password",
    title: "Windows 11 - Resetting the Local Administrator Password",
    summary:
      "This article provides step-by-step instructions to reset the local administrator password on a Windows 11 device using built-in recovery tools.",
    heroImageUrl: null,
    status: "published",
    readingTimeMinutes: 5,
    version: "1.2",
    category: { name: "Windows", slug: "windows" },
    tags: [
      { name: "Windows 11", slug: "windows-11" },
      { name: "Password", slug: "password" },
      { name: "Local Admin", slug: "local-admin" },
    ],
    author: { name: "Joe Clark" },
    sections: [
      {
        id: "sec-overview",
        kind: "overview",
        title: "Overview",
        order: 0,
        blocks: [
          {
            id: "blk-ov-1",
            kind: "prose",
            order: 0,
            content:
              "If you are unable to log in to a Windows 11 device with the local administrator account, you can reset the password using the built-in recovery environment. This process requires access to the Windows Recovery Environment (WinRE) and a separate administrator account or recovery options.",
          },
          {
            id: "blk-ov-2",
            kind: "callout",
            order: 1,
            variant: "important",
            title: "Important",
            content:
              "This process will not affect your Microsoft account. It only resets the local administrator password on the device.",
          },
        ],
      },
      {
        id: "sec-prereqs",
        kind: "prerequisites",
        title: "Prerequisites",
        order: 1,
        blocks: [
          {
            id: "blk-pr-1",
            kind: "checklist",
            order: 0,
            items: [
              "You have access to the Windows Recovery Environment (WinRE)",
              "You have a USB drive (optional, for advanced recovery options)",
              "You know the name of the account you want to reset",
            ],
          },
        ],
      },
      {
        id: "sec-steps",
        kind: "steps",
        title: "Step-by-Step Instructions",
        order: 2,
        blocks: [
          {
            id: "blk-st-1",
            kind: "step",
            order: 0,
            stepNumber: 1,
            title: "Boot into Windows Recovery Environment",
            content:
              '<ol><li>Restart the computer.</li><li>When the Windows logo appears, hold the <strong>Shift key</strong> and click <strong>Restart</strong> (or use the power menu and select <strong>Restart</strong> while holding <strong>Shift</strong>).</li><li>Select <strong>Troubleshoot</strong> &gt; <strong>Advanced options</strong> &gt; <strong>Command Prompt</strong>.</li></ol>',
          },
          {
            id: "blk-st-2",
            kind: "step",
            order: 1,
            stepNumber: 2,
            title: "Run the built-in password reset tool",
            content:
              "<ol><li>In the Command Prompt, type the following command and press <strong>Enter</strong>:</li></ol>",
          },
          {
            id: "blk-st-3",
            kind: "code",
            order: 2,
            language: "powershell",
            code: "net user Administrator *",
          },
          {
            id: "blk-st-4",
            kind: "prose",
            order: 3,
            content:
              "<ol start=\"2\"><li>Follow the prompts to enter and confirm the new password.</li><li>Type <code>exit</code> to close the Command Prompt.</li></ol>",
          },
          {
            id: "blk-st-5",
            kind: "step",
            order: 4,
            stepNumber: 3,
            title: "Restart and sign in",
            content:
              '<ol><li>Select <strong>Continue</strong> to restart into Windows normally.</li><li>On the login screen, select the <strong>Administrator</strong> account.</li><li>Enter the new password you just set.</li></ol>',
          },
        ],
      },
      {
        id: "sec-verify",
        kind: "verification",
        title: "Verification",
        order: 3,
        blocks: [
          {
            id: "blk-vf-1",
            kind: "checklist",
            order: 0,
            items: [
              "You can log in with the Administrator account using the new password",
              "Open Settings > Accounts to confirm the account name matches",
              "Run whoami in a terminal to verify you are signed in as the correct user",
            ],
          },
          {
            id: "blk-vf-2",
            kind: "code",
            order: 1,
            language: "powershell",
            code: "whoami\n# Expected output: DESKTOP-XXXX\\Administrator",
          },
        ],
      },
      {
        id: "sec-trouble",
        kind: "troubleshooting",
        title: "Troubleshooting",
        order: 4,
        blocks: [
          {
            id: "blk-tr-1",
            kind: "callout",
            order: 0,
            variant: "warning",
            title: "WinRE does not appear",
            content:
              'If holding <strong>Shift + Restart</strong> does not open the recovery environment, try booting from a Windows 11 installation USB. Select <strong>Repair your computer</strong> instead of <strong>Install</strong>.',
          },
          {
            id: "blk-tr-2",
            kind: "callout",
            order: 1,
            variant: "info",
            title: "Account is disabled",
            content:
              'The built-in Administrator account is disabled by default on consumer editions. Enable it first by running <code>net user Administrator /active:yes</code> from an elevated prompt or WinRE Command Prompt.',
          },
          {
            id: "blk-tr-3",
            kind: "callout",
            order: 2,
            variant: "warning",
            title: "BitLocker recovery key required",
            content:
              "If BitLocker is enabled, you will be prompted for the recovery key before accessing the Command Prompt. Retrieve the key from your organization's Azure AD / Entra ID portal or from the user's Microsoft account.",
          },
        ],
      },
      {
        id: "sec-related",
        kind: "related",
        title: "Related Articles",
        order: 5,
        blocks: [
          {
            id: "blk-rel-1",
            kind: "prose",
            order: 0,
            content:
              '<ul><li>Windows 11 - Creating a New Local User Account</li><li>Resetting Microsoft Account Password</li><li>Troubleshooting Windows Login Issues</li><li>Windows 11 - Safe Mode Access</li></ul>',
          },
        ],
      },
    ],
    views: 1247,
    helpful: 89,
    notHelpful: 4,
    createdAt: "2026-09-12T14:42:00Z",
    updatedAt: "2026-09-12T14:42:00Z",
    publishedAt: "2026-09-12T14:42:00Z",
  },
};

/** Lookup by slug; returns undefined if not found. */
export function getArticleBySlug(slug: string): Article | undefined {
  return SEED_ARTICLES[slug];
}

/** Related articles shown in the right rail (static for now). */
export const RELATED_ARTICLES = [
  {
    title: "Windows 11 - Creating a New Local User",
    slug: "windows-11-creating-new-local-user",
  },
  {
    title: "Resetting Microsoft Account Password",
    slug: "resetting-microsoft-account-password",
  },
  {
    title: "Troubleshooting Windows Login Issues",
    slug: "troubleshooting-windows-login-issues",
  },
  {
    title: "Windows 11 - Safe Mode Access",
    slug: "windows-11-safe-mode-access",
  },
];

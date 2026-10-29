/**
 * Seed articles — realistic IT content across multiple categories.
 * No lorem ipsum. Each article has enough structure to fill the list view
 * and at least a basic detail view.
 */

import type { Article } from "@/lib/types/article";

// ---------------------------------------------------------------------------
// Full article (north-star mock)
// ---------------------------------------------------------------------------

const WIN11_PASSWORD_RESET: Article = {
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
            '<ol start="2"><li>Follow the prompts to enter and confirm the new password.</li><li>Type <code>exit</code> to close the Command Prompt.</li></ol>',
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
            "<ul><li>Windows 11 - Creating a New Local User Account</li><li>Resetting Microsoft Account Password</li><li>Troubleshooting Windows Login Issues</li><li>Windows 11 - Safe Mode Access</li></ul>",
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
};

// ---------------------------------------------------------------------------
// Stub helper — creates a minimal article for the list view.
// Detail view will show a placeholder until full content is authored.
// ---------------------------------------------------------------------------

function stub(
  overrides: Partial<Article> & Pick<Article, "id" | "slug" | "title">,
): Article {
  return {
    summary: null,
    heroImageUrl: null,
    status: "published",
    readingTimeMinutes: 4,
    version: "1.0",
    category: null,
    tags: [],
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
            content: overrides.summary ?? "Article content coming soon.",
          },
        ],
      },
    ],
    views: 0,
    helpful: 0,
    notHelpful: 0,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    publishedAt: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Additional seed articles (stubs with realistic metadata)
// ---------------------------------------------------------------------------

const ARTICLES_LIST: Article[] = [
  WIN11_PASSWORD_RESET,

  stub({
    id: "KB-IT-1025",
    slug: "configuring-outlook-365-email-profiles",
    title: "Configuring Outlook 365 Email Profiles",
    summary:
      "Set up a new Outlook profile for Microsoft 365 mailboxes, including shared mailboxes and delegate access.",
    category: { name: "Microsoft 365", slug: "m365" },
    tags: [
      { name: "Outlook", slug: "outlook" },
      { name: "Email", slug: "email" },
      { name: "M365", slug: "m365" },
    ],
    author: { name: "Sarah Kim" },
    readingTimeMinutes: 6,
    version: "2.1",
    views: 832,
    helpful: 64,
    notHelpful: 7,
    createdAt: "2026-08-20T09:15:00Z",
    updatedAt: "2026-10-05T11:30:00Z",
    publishedAt: "2026-08-22T13:00:00Z",
  }),

  stub({
    id: "KB-IT-1026",
    slug: "linux-ssh-key-rotation-policy",
    title: "Linux - SSH Key Rotation Policy and Procedure",
    summary:
      "Standard procedure for rotating SSH keys on production Linux hosts, including automation with Ansible.",
    category: { name: "Linux", slug: "linux" },
    tags: [
      { name: "SSH", slug: "ssh" },
      { name: "Security", slug: "security" },
      { name: "Ansible", slug: "ansible" },
    ],
    author: { name: "Raj Patel" },
    readingTimeMinutes: 8,
    version: "1.4",
    views: 421,
    helpful: 38,
    notHelpful: 2,
    createdAt: "2026-07-10T16:00:00Z",
    updatedAt: "2026-09-28T08:45:00Z",
    publishedAt: "2026-07-12T09:00:00Z",
  }),

  stub({
    id: "KB-IT-1027",
    slug: "vpn-split-tunnel-configuration",
    title: "VPN Split-Tunnel Configuration for Remote Workers",
    summary:
      "Configure split-tunnel VPN profiles in GlobalProtect to route only corporate traffic through the tunnel.",
    category: { name: "Networking", slug: "networking" },
    tags: [
      { name: "VPN", slug: "vpn" },
      { name: "GlobalProtect", slug: "globalprotect" },
      { name: "Remote Access", slug: "remote-access" },
    ],
    author: { name: "Marcus Rivera" },
    readingTimeMinutes: 7,
    version: "1.1",
    views: 956,
    helpful: 71,
    notHelpful: 5,
    createdAt: "2026-06-15T12:00:00Z",
    updatedAt: "2026-09-10T14:20:00Z",
    publishedAt: "2026-06-18T10:00:00Z",
  }),

  stub({
    id: "KB-IT-1028",
    slug: "active-directory-group-policy-troubleshooting",
    title: "Active Directory - Group Policy Troubleshooting Guide",
    summary:
      "Diagnose and fix common GPO issues: inheritance blocking, WMI filter failures, replication lag, and resultant set of policy (RSoP) analysis.",
    category: { name: "Active Directory", slug: "active-directory" },
    tags: [
      { name: "GPO", slug: "gpo" },
      { name: "Troubleshooting", slug: "troubleshooting" },
      { name: "Active Directory", slug: "active-directory" },
    ],
    author: { name: "Joe Clark" },
    readingTimeMinutes: 12,
    version: "2.0",
    views: 2103,
    helpful: 142,
    notHelpful: 8,
    createdAt: "2026-05-01T08:00:00Z",
    updatedAt: "2026-10-08T16:00:00Z",
    publishedAt: "2026-05-05T09:00:00Z",
  }),

  stub({
    id: "KB-IT-1029",
    slug: "windows-defender-exclusion-management",
    title: "Windows Defender - Managing Antivirus Exclusions via Intune",
    summary:
      "Create and deploy antivirus exclusion policies through Microsoft Intune for line-of-business applications.",
    category: { name: "Security", slug: "security" },
    tags: [
      { name: "Defender", slug: "defender" },
      { name: "Intune", slug: "intune" },
      { name: "Antivirus", slug: "antivirus" },
    ],
    author: { name: "Sarah Kim" },
    readingTimeMinutes: 5,
    version: "1.0",
    status: "in_review",
    views: 54,
    helpful: 3,
    notHelpful: 0,
    createdAt: "2026-10-06T10:00:00Z",
    updatedAt: "2026-10-10T15:30:00Z",
    publishedAt: null,
  }),

  stub({
    id: "KB-IT-1030",
    slug: "teams-meeting-room-device-setup",
    title: "Microsoft Teams - Meeting Room Device Setup (Poly / Logitech)",
    summary:
      "Provision and configure Teams Rooms on Android/Windows for Poly Studio X and Logitech Rally Bar devices.",
    category: { name: "Microsoft 365", slug: "m365" },
    tags: [
      { name: "Teams", slug: "teams" },
      { name: "Meeting Rooms", slug: "meeting-rooms" },
      { name: "Hardware", slug: "hardware" },
    ],
    author: { name: "Marcus Rivera" },
    readingTimeMinutes: 10,
    version: "1.3",
    views: 318,
    helpful: 27,
    notHelpful: 3,
    createdAt: "2026-08-01T14:00:00Z",
    updatedAt: "2026-09-22T10:00:00Z",
    publishedAt: "2026-08-05T09:00:00Z",
  }),

  stub({
    id: "KB-IT-1031",
    slug: "linux-disk-space-recovery-procedures",
    title: "Linux - Disk Space Recovery Procedures",
    summary:
      "Identify and reclaim disk space on Linux servers: large file discovery, journal cleanup, log rotation, and docker image pruning.",
    category: { name: "Linux", slug: "linux" },
    tags: [
      { name: "Disk Space", slug: "disk-space" },
      { name: "Maintenance", slug: "maintenance" },
      { name: "Docker", slug: "docker" },
    ],
    author: { name: "Raj Patel" },
    readingTimeMinutes: 6,
    version: "1.2",
    views: 729,
    helpful: 55,
    notHelpful: 1,
    createdAt: "2026-07-25T11:00:00Z",
    updatedAt: "2026-10-01T09:15:00Z",
    publishedAt: "2026-07-28T08:00:00Z",
  }),

  stub({
    id: "KB-IT-1032",
    slug: "dhcp-scope-exhaustion-resolution",
    title: "DHCP Scope Exhaustion - Diagnosis and Resolution",
    summary:
      "Investigate DHCP scope exhaustion on Windows Server, extend or split scopes, and implement lease-time tuning.",
    category: { name: "Networking", slug: "networking" },
    tags: [
      { name: "DHCP", slug: "dhcp" },
      { name: "Windows Server", slug: "windows-server" },
      { name: "IP Management", slug: "ip-management" },
    ],
    author: { name: "Joe Clark" },
    readingTimeMinutes: 7,
    version: "1.0",
    status: "draft",
    views: 12,
    helpful: 0,
    notHelpful: 0,
    createdAt: "2026-10-10T08:00:00Z",
    updatedAt: "2026-10-11T17:00:00Z",
    publishedAt: null,
  }),

  stub({
    id: "KB-IT-1033",
    slug: "servicenow-incident-integration",
    title: "ServiceNow - Configuring Incident Integration with Teams Alerts",
    summary:
      "Set up bi-directional incident sync between ServiceNow and Microsoft Teams using Power Automate flows.",
    category: { name: "Integrations", slug: "integrations" },
    tags: [
      { name: "ServiceNow", slug: "servicenow" },
      { name: "Teams", slug: "teams" },
      { name: "Power Automate", slug: "power-automate" },
    ],
    author: { name: "Sarah Kim" },
    readingTimeMinutes: 9,
    version: "1.1",
    views: 187,
    helpful: 15,
    notHelpful: 1,
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-18T14:00:00Z",
    publishedAt: "2026-09-05T11:00:00Z",
  }),

  stub({
    id: "KB-IT-1034",
    slug: "windows-11-bitlocker-recovery-process",
    title: "Windows 11 - BitLocker Recovery Key Retrieval Process",
    summary:
      "Retrieve BitLocker recovery keys from Entra ID, Active Directory, or MBAM for locked-out devices.",
    category: { name: "Windows", slug: "windows" },
    tags: [
      { name: "BitLocker", slug: "bitlocker" },
      { name: "Encryption", slug: "encryption" },
      { name: "Recovery", slug: "recovery" },
    ],
    author: { name: "Joe Clark" },
    readingTimeMinutes: 4,
    version: "2.3",
    views: 1893,
    helpful: 156,
    notHelpful: 6,
    createdAt: "2026-04-10T09:00:00Z",
    updatedAt: "2026-10-02T12:00:00Z",
    publishedAt: "2026-04-15T10:00:00Z",
  }),

  stub({
    id: "KB-IT-1035",
    slug: "entra-conditional-access-blocked-sign-in",
    title: "Entra ID - Troubleshooting Conditional Access Blocked Sign-Ins",
    summary:
      "Find why a user was blocked by Conditional Access, read the sign-in log, and apply a temporary exclusion without weakening the tenant baseline.",
    category: { name: "Security", slug: "security" },
    tags: [
      { name: "Conditional Access", slug: "conditional-access" },
      { name: "Entra ID", slug: "entra-id" },
      { name: "Troubleshooting", slug: "troubleshooting" },
    ],
    author: { name: "Marcus Rivera" },
    readingTimeMinutes: 7,
    version: "1.0",
    views: 412,
    helpful: 29,
    notHelpful: 3,
  }),

  stub({
    id: "KB-IT-1036",
    slug: "intune-windows-update-ring-stuck",
    title: "Intune - Clearing a Stuck Windows Update Ring Deployment",
    summary:
      "Diagnose devices that never leave a Windows Update quality ring, force a scan, and confirm the update inventory in Intune.",
    category: { name: "Windows", slug: "windows" },
    tags: [
      { name: "Windows Update", slug: "windows-update" },
      { name: "Intune", slug: "intune" },
      { name: "Windows 11", slug: "windows-11" },
    ],
    author: { name: "Joe Clark" },
    readingTimeMinutes: 6,
    version: "1.2",
    views: 268,
    helpful: 21,
    notHelpful: 2,
  }),

  stub({
    id: "KB-IT-1037",
    slug: "iis-internal-tls-certificate-renewal",
    title: "IIS - Renewing an Internal TLS Certificate",
    summary:
      "Replace an expiring certificate on a Windows IIS site, bind the new thumbprint, and recycle the app pool without dropping the hostname mapping.",
    category: { name: "Security", slug: "security" },
    tags: [
      { name: "Certificates", slug: "certificates" },
      { name: "IIS", slug: "iis" },
      { name: "Encryption", slug: "encryption" },
    ],
    author: { name: "Raj Patel" },
    readingTimeMinutes: 8,
    version: "1.1",
    views: 193,
    helpful: 17,
    notHelpful: 1,
  }),

  stub({
    id: "KB-IT-1038",
    slug: "exchange-online-shared-mailbox-permissions",
    title: "Exchange Online - Granting Shared Mailbox Permissions",
    summary:
      "Add Full Access and Send As for a shared mailbox in Exchange Online and confirm Outlook autoconfiguration.",
    category: { name: "Microsoft 365", slug: "m365" },
    tags: [
      { name: "Exchange Online", slug: "exchange-online" },
      { name: "Shared Mailbox", slug: "shared-mailbox" },
      { name: "Email", slug: "email" },
    ],
    author: { name: "Sarah Kim" },
    readingTimeMinutes: 5,
    version: "2.0",
    views: 744,
    helpful: 58,
    notHelpful: 4,
  }),

  stub({
    id: "KB-IT-1039",
    slug: "dns-client-cache-and-scavenging-checks",
    title: "DNS - Client Cache Flush and Server Scavenging Checks",
    summary:
      "Clear a stale DNS client cache, verify authoritative records, and confirm scavenging settings on Windows DNS before deleting aged records.",
    category: { name: "Networking", slug: "networking" },
    tags: [
      { name: "DNS", slug: "dns" },
      { name: "Windows Server", slug: "windows-server" },
      { name: "Troubleshooting", slug: "troubleshooting" },
    ],
    author: { name: "Raj Patel" },
    readingTimeMinutes: 6,
    version: "1.0",
    views: 156,
    helpful: 12,
    notHelpful: 0,
  }),

  stub({
    id: "KB-IT-1040",
    slug: "linux-sudoers-break-glass-access",
    title: "Linux - Granting Break-Glass Sudo Access Safely",
    summary:
      "Add a time-limited sudoers drop-in for break-glass access, validate with visudo, and remove the grant after the incident.",
    category: { name: "Linux", slug: "linux" },
    tags: [
      { name: "Sudo", slug: "sudo" },
      { name: "Security", slug: "security" },
      { name: "Troubleshooting", slug: "troubleshooting" },
    ],
    author: { name: "Raj Patel" },
    readingTimeMinutes: 5,
    version: "1.3",
    views: 98,
    helpful: 11,
    notHelpful: 1,
  }),

  stub({
    id: "KB-IT-1041",
    slug: "print-server-clearing-stuck-jobs",
    title: "Print Server - Clearing Stuck Jobs on Windows Server",
    summary:
      "Drain a hung print queue, restart the spooler safely, and confirm clients can print again without deleting unrelated queues.",
    category: { name: "Windows", slug: "windows" },
    tags: [
      { name: "Print Server", slug: "print-server" },
      { name: "Windows Server", slug: "windows-server" },
      { name: "Troubleshooting", slug: "troubleshooting" },
    ],
    author: { name: "Joe Clark" },
    readingTimeMinutes: 4,
    version: "1.0",
    views: 321,
    helpful: 24,
    notHelpful: 2,
  }),

  stub({
    id: "KB-IT-1042",
    slug: "jira-servicenow-webhook-bridge",
    title: "Integrations - Jira Webhook Bridge to ServiceNow Incidents",
    summary:
      "Configure a Jira webhook that creates or updates a ServiceNow incident, including shared secret validation and field mapping.",
    category: { name: "Integrations", slug: "integrations" },
    tags: [
      { name: "Jira", slug: "jira" },
      { name: "ServiceNow", slug: "servicenow" },
      { name: "Webhook", slug: "webhook" },
    ],
    author: { name: "Sarah Kim" },
    readingTimeMinutes: 10,
    version: "1.0",
    views: 87,
    helpful: 9,
    notHelpful: 0,
  }),

  stub({
    id: "KB-IT-1043",
    slug: "ad-computer-object-cleanup",
    title: "Active Directory - Stale Computer Object Cleanup",
    summary:
      "Find computer accounts that have not signed on recently, disable them safely, and move them to a quarantine OU before deletion.",
    category: { name: "Active Directory", slug: "active-directory" },
    tags: [
      { name: "Active Directory", slug: "active-directory" },
      { name: "Maintenance", slug: "maintenance" },
      { name: "Windows Server", slug: "windows-server" },
    ],
    author: { name: "Marcus Rivera" },
    readingTimeMinutes: 7,
    version: "1.1",
    views: 205,
    helpful: 18,
    notHelpful: 1,
  }),
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const SEED_ARTICLES: Record<string, Article> = Object.fromEntries(
  ARTICLES_LIST.map((a) => [a.slug, a]),
);

/** All articles as a flat array (for list views). */
export const ALL_ARTICLES: Article[] = ARTICLES_LIST;

/** Lookup by slug; returns undefined if not found. */
export function getArticleBySlug(slug: string): Article | undefined {
  return SEED_ARTICLES[slug];
}

/** Unique categories across all seed articles. */
export const ALL_CATEGORIES = [
  ...new Map(
    ALL_ARTICLES.filter((a) => a.category)
      .map((a) => a.category!)
      .map((c) => [c.slug, c]),
  ).values(),
].sort((a, b) => a.name.localeCompare(b.name));

/** Unique statuses present in seed data. */
export const ALL_STATUSES: Article["status"][] = [
  "published",
  "in_review",
  "draft",
  "archived",
];

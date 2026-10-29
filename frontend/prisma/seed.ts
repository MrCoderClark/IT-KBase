/**
 * Prisma seed — creates users, categories, tags, and ~20 realistic IT articles
 * with full section + block structure. No lorem ipsum.
 *
 * Run: pnpm exec prisma db seed
 */

import {
  PrismaClient,
  Role,
  ArticleStatus,
  SectionKind,
  BlockKind,
  CalloutVariant,
} from "@prisma/client";
import { DEV_ACCOUNT_PASSWORD } from "../lib/auth/dev-password";
import { passwordHasher } from "../lib/auth/password";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SeedBlock = {
  kind: BlockKind;
  order: number;
  content?: unknown;
  stepNumber?: number;
  calloutVariant?: CalloutVariant;
  language?: string;
  code?: string;
  imageUrl?: string;
  imageAlt?: string;
};

type SeedSection = {
  kind: SectionKind;
  title: string;
  order: number;
  blocks: SeedBlock[];
};

type SeedArticle = {
  slug: string;
  title: string;
  summary: string | null;
  status: ArticleStatus;
  readingTimeMinutes: number;
  version: string;
  categorySlug: string;
  tagSlugs: string[];
  authorEmail: string;
  views: number;
  helpful: number;
  notHelpful: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  sections: SeedSection[];
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const USERS = [
  { email: "joe.clark@techbase.local", name: "Joe Clark", role: Role.admin },
  { email: "sarah.kim@techbase.local", name: "Sarah Kim", role: Role.author },
  { email: "raj.patel@techbase.local", name: "Raj Patel", role: Role.author },
  {
    email: "marcus.rivera@techbase.local",
    name: "Marcus Rivera",
    role: Role.reviewer,
  },
];

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: "Windows", slug: "windows" },
  { name: "Linux", slug: "linux" },
  { name: "Microsoft 365", slug: "m365" },
  { name: "Networking", slug: "networking" },
  { name: "Security", slug: "security" },
  { name: "Active Directory", slug: "active-directory" },
  { name: "Integrations", slug: "integrations" },
];

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

const TAGS = [
  { name: "Windows 11", slug: "windows-11" },
  { name: "Password", slug: "password" },
  { name: "Local Admin", slug: "local-admin" },
  { name: "Outlook", slug: "outlook" },
  { name: "Email", slug: "email" },
  { name: "M365", slug: "m365" },
  { name: "SSH", slug: "ssh" },
  { name: "Ansible", slug: "ansible" },
  { name: "VPN", slug: "vpn" },
  { name: "GlobalProtect", slug: "globalprotect" },
  { name: "Remote Access", slug: "remote-access" },
  { name: "GPO", slug: "gpo" },
  { name: "Troubleshooting", slug: "troubleshooting" },
  { name: "Active Directory", slug: "active-directory" },
  { name: "Defender", slug: "defender" },
  { name: "Intune", slug: "intune" },
  { name: "Antivirus", slug: "antivirus" },
  { name: "Teams", slug: "teams" },
  { name: "Meeting Rooms", slug: "meeting-rooms" },
  { name: "Hardware", slug: "hardware" },
  { name: "Disk Space", slug: "disk-space" },
  { name: "Maintenance", slug: "maintenance" },
  { name: "Docker", slug: "docker" },
  { name: "Security", slug: "security" },
  { name: "DHCP", slug: "dhcp" },
  { name: "Windows Server", slug: "windows-server" },
  { name: "IP Management", slug: "ip-management" },
  { name: "ServiceNow", slug: "servicenow" },
  { name: "Power Automate", slug: "power-automate" },
  { name: "BitLocker", slug: "bitlocker" },
  { name: "Encryption", slug: "encryption" },
  { name: "Recovery", slug: "recovery" },
  { name: "Conditional Access", slug: "conditional-access" },
  { name: "Entra ID", slug: "entra-id" },
  { name: "Certificates", slug: "certificates" },
  { name: "IIS", slug: "iis" },
  { name: "Exchange Online", slug: "exchange-online" },
  { name: "Shared Mailbox", slug: "shared-mailbox" },
  { name: "DNS", slug: "dns" },
  { name: "Sudo", slug: "sudo" },
  { name: "Print Server", slug: "print-server" },
  { name: "Windows Update", slug: "windows-update" },
  { name: "Jira", slug: "jira" },
  { name: "Webhook", slug: "webhook" },
];

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

const ARTICLES: SeedArticle[] = [
  {
    slug: "windows-11-resetting-local-administrator-password",
    title: "Windows 11 - Resetting the Local Administrator Password",
    summary:
      "This article provides step-by-step instructions to reset the local administrator password on a Windows 11 device using built-in recovery tools.",
    status: ArticleStatus.published,
    readingTimeMinutes: 5,
    version: "1.2",
    categorySlug: "windows",
    tagSlugs: ["windows-11", "password", "local-admin"],
    authorEmail: "joe.clark@techbase.local",
    views: 1247,
    helpful: 89,
    notHelpful: 4,
    createdAt: new Date("2026-09-12T14:42:00Z"),
    updatedAt: new Date("2026-09-12T14:42:00Z"),
    publishedAt: new Date("2026-09-12T14:42:00Z"),
    sections: [
      {
        kind: SectionKind.overview,
        title: "Overview",
        order: 0,
        blocks: [
          {
            kind: BlockKind.prose,
            order: 0,
            content:
              "If you are unable to log in to a Windows 11 device with the local administrator account, you can reset the password using the built-in recovery environment. This process requires access to the Windows Recovery Environment (WinRE) and a separate administrator account or recovery options.",
          },
          {
            kind: BlockKind.callout,
            order: 1,
            calloutVariant: CalloutVariant.important,
            content:
              "This process will not affect your Microsoft account. It only resets the local administrator password on the device.",
          },
        ],
      },
      {
        kind: SectionKind.prerequisites,
        title: "Prerequisites",
        order: 1,
        blocks: [
          {
            kind: BlockKind.checklist,
            order: 0,
            content: [
              "You have access to the Windows Recovery Environment (WinRE)",
              "You have a USB drive (optional, for advanced recovery options)",
              "You know the name of the account you want to reset",
            ],
          },
        ],
      },
      {
        kind: SectionKind.steps,
        title: "Step-by-Step Instructions",
        order: 2,
        blocks: [
          {
            kind: BlockKind.step,
            order: 0,
            stepNumber: 1,
            content: {
              title: "Boot into Windows Recovery Environment",
              body: '<ol><li>Restart the computer.</li><li>When the Windows logo appears, hold the <strong>Shift key</strong> and click <strong>Restart</strong>.</li><li>Select <strong>Troubleshoot</strong> &gt; <strong>Advanced options</strong> &gt; <strong>Command Prompt</strong>.</li></ol>',
            },
          },
          {
            kind: BlockKind.step,
            order: 1,
            stepNumber: 2,
            content: {
              title: "Run the built-in password reset tool",
              body: "<ol><li>In the Command Prompt, type the following command and press <strong>Enter</strong>:</li></ol>",
            },
          },
          {
            kind: BlockKind.code,
            order: 2,
            language: "powershell",
            code: "net user Administrator *",
          },
          {
            kind: BlockKind.step,
            order: 3,
            stepNumber: 3,
            content: {
              title: "Restart and sign in",
              body: '<ol><li>Select <strong>Continue</strong> to restart into Windows normally.</li><li>On the login screen, select the <strong>Administrator</strong> account.</li><li>Enter the new password you just set.</li></ol>',
            },
          },
        ],
      },
      {
        kind: SectionKind.verification,
        title: "Verification",
        order: 3,
        blocks: [
          {
            kind: BlockKind.checklist,
            order: 0,
            content: [
              "You can log in with the Administrator account using the new password",
              "Open Settings > Accounts to confirm the account name matches",
              "Run whoami in a terminal to verify you are signed in as the correct user",
            ],
          },
          {
            kind: BlockKind.code,
            order: 1,
            language: "powershell",
            code: "whoami\n# Expected output: DESKTOP-XXXX\\Administrator",
          },
        ],
      },
      {
        kind: SectionKind.troubleshooting,
        title: "Troubleshooting",
        order: 4,
        blocks: [
          {
            kind: BlockKind.callout,
            order: 0,
            calloutVariant: CalloutVariant.warning,
            content: {
              title: "WinRE does not appear",
              body: 'If holding <strong>Shift + Restart</strong> does not open the recovery environment, try booting from a Windows 11 installation USB. Select <strong>Repair your computer</strong> instead of <strong>Install</strong>.',
            },
          },
          {
            kind: BlockKind.callout,
            order: 1,
            calloutVariant: CalloutVariant.info,
            content: {
              title: "Account is disabled",
              body: 'The built-in Administrator account is disabled by default on consumer editions. Enable it first by running <code>net user Administrator /active:yes</code> from an elevated prompt or WinRE Command Prompt.',
            },
          },
          {
            kind: BlockKind.callout,
            order: 2,
            calloutVariant: CalloutVariant.warning,
            content: {
              title: "BitLocker recovery key required",
              body: "If BitLocker is enabled, you will be prompted for the recovery key before accessing the Command Prompt. Retrieve the key from your organization's Azure AD / Entra ID portal or from the user's Microsoft account.",
            },
          },
        ],
      },
      {
        kind: SectionKind.related,
        title: "Related Articles",
        order: 5,
        blocks: [
          {
            kind: BlockKind.prose,
            order: 0,
            content:
              "<ul><li>Windows 11 - Creating a New Local User Account</li><li>Resetting Microsoft Account Password</li><li>Troubleshooting Windows Login Issues</li><li>Windows 11 - Safe Mode Access</li></ul>",
          },
        ],
      },
    ],
  },
  // --- Stub articles (overview section only) ---
  stubArticle({
    slug: "configuring-outlook-365-email-profiles",
    title: "Configuring Outlook 365 Email Profiles",
    summary:
      "Set up a new Outlook profile for Microsoft 365 mailboxes, including shared mailboxes and delegate access.",
    categorySlug: "m365",
    tagSlugs: ["outlook", "email", "m365"],
    authorEmail: "sarah.kim@techbase.local",
    readingTimeMinutes: 6,
    version: "2.1",
    views: 832,
    helpful: 64,
    notHelpful: 7,
    createdAt: new Date("2026-08-20T09:15:00Z"),
    updatedAt: new Date("2026-10-05T11:30:00Z"),
    publishedAt: new Date("2026-08-22T13:00:00Z"),
  }),
  stubArticle({
    slug: "linux-ssh-key-rotation-policy",
    title: "Linux - SSH Key Rotation Policy and Procedure",
    summary:
      "Standard procedure for rotating SSH keys on production Linux hosts, including automation with Ansible.",
    categorySlug: "linux",
    tagSlugs: ["ssh", "security", "ansible"],
    authorEmail: "raj.patel@techbase.local",
    readingTimeMinutes: 8,
    version: "1.4",
    views: 421,
    helpful: 38,
    notHelpful: 2,
    createdAt: new Date("2026-07-10T16:00:00Z"),
    updatedAt: new Date("2026-09-28T08:45:00Z"),
    publishedAt: new Date("2026-07-12T09:00:00Z"),
  }),
  stubArticle({
    slug: "vpn-split-tunnel-configuration",
    title: "VPN Split-Tunnel Configuration for Remote Workers",
    summary:
      "Configure split-tunnel VPN profiles in GlobalProtect to route only corporate traffic through the tunnel.",
    categorySlug: "networking",
    tagSlugs: ["vpn", "globalprotect", "remote-access"],
    authorEmail: "marcus.rivera@techbase.local",
    readingTimeMinutes: 7,
    version: "1.1",
    views: 956,
    helpful: 71,
    notHelpful: 5,
    createdAt: new Date("2026-06-15T12:00:00Z"),
    updatedAt: new Date("2026-09-10T14:20:00Z"),
    publishedAt: new Date("2026-06-18T10:00:00Z"),
  }),
  stubArticle({
    slug: "active-directory-group-policy-troubleshooting",
    title: "Active Directory - Group Policy Troubleshooting Guide",
    summary:
      "Diagnose and fix common GPO issues: inheritance blocking, WMI filter failures, replication lag, and resultant set of policy (RSoP) analysis.",
    categorySlug: "active-directory",
    tagSlugs: ["gpo", "troubleshooting", "active-directory"],
    authorEmail: "joe.clark@techbase.local",
    readingTimeMinutes: 12,
    version: "2.0",
    views: 2103,
    helpful: 142,
    notHelpful: 8,
    createdAt: new Date("2026-05-01T08:00:00Z"),
    updatedAt: new Date("2026-10-08T16:00:00Z"),
    publishedAt: new Date("2026-05-05T09:00:00Z"),
  }),
  stubArticle({
    slug: "windows-defender-exclusion-management",
    title: "Windows Defender - Managing Antivirus Exclusions via Intune",
    summary:
      "Create and deploy antivirus exclusion policies through Microsoft Intune for line-of-business applications.",
    categorySlug: "security",
    tagSlugs: ["defender", "intune", "antivirus"],
    authorEmail: "sarah.kim@techbase.local",
    readingTimeMinutes: 5,
    version: "1.0",
    status: ArticleStatus.in_review,
    views: 54,
    helpful: 3,
    notHelpful: 0,
    createdAt: new Date("2026-10-06T10:00:00Z"),
    updatedAt: new Date("2026-10-10T15:30:00Z"),
    publishedAt: null,
  }),
  stubArticle({
    slug: "teams-meeting-room-device-setup",
    title: "Microsoft Teams - Meeting Room Device Setup (Poly / Logitech)",
    summary:
      "Provision and configure Teams Rooms on Android/Windows for Poly Studio X and Logitech Rally Bar devices.",
    categorySlug: "m365",
    tagSlugs: ["teams", "meeting-rooms", "hardware"],
    authorEmail: "marcus.rivera@techbase.local",
    readingTimeMinutes: 10,
    version: "1.3",
    views: 318,
    helpful: 27,
    notHelpful: 3,
    createdAt: new Date("2026-08-01T14:00:00Z"),
    updatedAt: new Date("2026-09-22T10:00:00Z"),
    publishedAt: new Date("2026-08-05T09:00:00Z"),
  }),
  stubArticle({
    slug: "linux-disk-space-recovery-procedures",
    title: "Linux - Disk Space Recovery Procedures",
    summary:
      "Identify and reclaim disk space on Linux servers: large file discovery, journal cleanup, log rotation, and docker image pruning.",
    categorySlug: "linux",
    tagSlugs: ["disk-space", "maintenance", "docker"],
    authorEmail: "raj.patel@techbase.local",
    readingTimeMinutes: 6,
    version: "1.2",
    views: 729,
    helpful: 55,
    notHelpful: 1,
    createdAt: new Date("2026-07-25T11:00:00Z"),
    updatedAt: new Date("2026-10-01T09:15:00Z"),
    publishedAt: new Date("2026-07-28T08:00:00Z"),
  }),
  stubArticle({
    slug: "dhcp-scope-exhaustion-resolution",
    title: "DHCP Scope Exhaustion - Diagnosis and Resolution",
    summary:
      "Investigate DHCP scope exhaustion on Windows Server, extend or split scopes, and implement lease-time tuning.",
    categorySlug: "networking",
    tagSlugs: ["dhcp", "windows-server", "ip-management"],
    authorEmail: "joe.clark@techbase.local",
    readingTimeMinutes: 7,
    version: "1.0",
    status: ArticleStatus.draft,
    views: 12,
    helpful: 0,
    notHelpful: 0,
    createdAt: new Date("2026-10-10T08:00:00Z"),
    updatedAt: new Date("2026-10-11T17:00:00Z"),
    publishedAt: null,
  }),
  stubArticle({
    slug: "servicenow-incident-integration",
    title: "ServiceNow - Configuring Incident Integration with Teams Alerts",
    summary:
      "Set up bi-directional incident sync between ServiceNow and Microsoft Teams using Power Automate flows.",
    categorySlug: "integrations",
    tagSlugs: ["servicenow", "teams", "power-automate"],
    authorEmail: "sarah.kim@techbase.local",
    readingTimeMinutes: 9,
    version: "1.1",
    views: 187,
    helpful: 15,
    notHelpful: 1,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-18T14:00:00Z"),
    publishedAt: new Date("2026-09-05T11:00:00Z"),
  }),
  stubArticle({
    slug: "windows-11-bitlocker-recovery-process",
    title: "Windows 11 - BitLocker Recovery Key Retrieval Process",
    summary:
      "Retrieve BitLocker recovery keys from Entra ID, Active Directory, or MBAM for locked-out devices.",
    categorySlug: "windows",
    tagSlugs: ["bitlocker", "encryption", "recovery"],
    authorEmail: "joe.clark@techbase.local",
    readingTimeMinutes: 4,
    version: "2.3",
    views: 1893,
    helpful: 156,
    notHelpful: 6,
    createdAt: new Date("2026-04-10T09:00:00Z"),
    updatedAt: new Date("2026-10-02T12:00:00Z"),
    publishedAt: new Date("2026-04-15T10:00:00Z"),
  }),

  procedureArticle({
    slug: "entra-conditional-access-blocked-sign-in",
    title: "Entra ID - Troubleshooting Conditional Access Blocked Sign-Ins",
    summary:
      "Find why a user was blocked by Conditional Access, read the sign-in log, and apply a temporary exclusion without weakening the tenant baseline.",
    categorySlug: "security",
    tagSlugs: ["conditional-access", "entra-id", "troubleshooting"],
    authorEmail: "marcus.rivera@techbase.local",
    readingTimeMinutes: 7,
    version: "1.0",
    views: 412,
    helpful: 29,
    notHelpful: 3,
    createdAt: new Date("2026-08-01T10:00:00Z"),
    updatedAt: new Date("2026-10-20T15:00:00Z"),
    publishedAt: new Date("2026-08-04T12:00:00Z"),
    overview:
      "When a user reports they cannot sign in to Microsoft 365, Conditional Access is a frequent cause. Use the Entra sign-in logs to identify the failing policy, confirm the intended control still applies to everyone else, then grant a time-boxed exception only when the business needs it.",
    important:
      "Do not disable a Conditional Access policy to unblock one person. Prefer a named exclusion group with an expiry ticket.",
    prerequisites: [
      "Entra ID Global Reader or Conditional Access Administrator",
      "The user’s UPN and approximate failure time (UTC)",
      "Access to the IT change ticket for any exclusion",
    ],
    steps: [
      {
        title: "Open the failed sign-in",
        body: "In Entra ID → Monitoring → Sign-in logs, filter by user and Failure. Open the latest interactive failure and note the Conditional Access tab.",
      },
      {
        title: "Identify the policy and control",
        body: "Confirm which policy Result is Failure and which grant control blocked the session (MFA, compliant device, approved client app, or location).",
      },
      {
        title: "Validate expected membership",
        body: "Check whether the user should satisfy the control (registered MFA method, Intune compliance, named location). Fix the root cause when possible instead of excluding.",
      },
      {
        title: "Apply a temporary exclusion if required",
        body: "Add the user to the documented CA-Exclusion-Temp security group, set a ticket due date (max 7 days), and retest sign-in.",
        code: "Get-MgGroupMember -GroupId <exclusion-group-id>",
        language: "powershell",
      },
    ],
    verification: [
      "A new interactive sign-in for the user shows Success",
      "The Conditional Access tab shows the policy as report-only or not applied for that session",
      "The exclusion ticket has an owner and removal date",
    ],
    troubleshooting: [
      {
        title: "Sign-in still fails after exclusion",
        body: "Another policy may still apply. Re-check the Conditional Access tab for a second Failure row, including session controls.",
      },
      {
        title: "User has no MFA methods",
        body: "Have them complete security info registration from a trusted network, or use Temporary Access Pass per the MFA runbook.",
      },
    ],
  }),

  procedureArticle({
    slug: "intune-windows-update-ring-stuck",
    title: "Intune - Clearing a Stuck Windows Update Ring Deployment",
    summary:
      "Diagnose devices that never leave a Windows Update quality ring, force a scan, and confirm the update inventory in Intune.",
    categorySlug: "windows",
    tagSlugs: ["windows-update", "intune", "windows-11"],
    authorEmail: "joe.clark@techbase.local",
    readingTimeMinutes: 6,
    version: "1.2",
    views: 268,
    helpful: 21,
    notHelpful: 2,
    createdAt: new Date("2026-06-12T09:00:00Z"),
    updatedAt: new Date("2026-10-08T11:00:00Z"),
    publishedAt: new Date("2026-06-15T10:00:00Z"),
    overview:
      "Quality updates can stall when the update ring, feature deferral, or the Windows Update client state is inconsistent. Confirm the device is in the correct Intune ring, inspect Update Compliance, then reset the local WU client if the scan never starts.",
    prerequisites: [
      "Intune Administrator or Helpdesk role with device read",
      "Local admin on the endpoint (or remote PowerShell)",
      "Known KB or quality update the device should install",
    ],
    steps: [
      {
        title: "Confirm ring assignment",
        body: "In Intune → Devices → Windows → Update rings, open the ring and verify the device (or its primary user group) is included and not excluded.",
      },
      {
        title: "Check Update status in Intune",
        body: "Open the device → Monitor → Windows update (or Reports → Windows updates) and note Last scan time and any error code.",
      },
      {
        title: "Force a client scan",
        body: "On the device, restart Windows Update services and trigger a scan. Wait for Intune to refresh (up to 8 hours, or sync from Company Portal).",
        code: "Restart-Service wuauserv,bits,cryptsvc -Force\nUsoClient StartInteractiveScan",
        language: "powershell",
      },
      {
        title: "Clear a corrupted SoftwareDistribution cache if needed",
        body: "Only if scans fail with 0x8024xxxx errors: stop services, rename SoftwareDistribution and Catroot2, restart services, then scan again.",
      },
    ],
    verification: [
      "Last scan time is within the last hour",
      "The target quality update shows Installing or Installed",
      "Device still appears only in the intended update ring",
    ],
  }),

  procedureArticle({
    slug: "iis-internal-tls-certificate-renewal",
    title: "IIS - Renewing an Internal TLS Certificate",
    summary:
      "Replace an expiring certificate on a Windows IIS site, bind the new thumbprint, and recycle the app pool without dropping the hostname mapping.",
    categorySlug: "security",
    tagSlugs: ["certificates", "iis", "encryption"],
    authorEmail: "raj.patel@techbase.local",
    readingTimeMinutes: 8,
    version: "1.1",
    views: 193,
    helpful: 17,
    notHelpful: 1,
    createdAt: new Date("2026-05-20T14:00:00Z"),
    updatedAt: new Date("2026-09-30T09:00:00Z"),
    publishedAt: new Date("2026-05-22T16:00:00Z"),
    overview:
      "Internal IIS sites that terminate TLS with a private CA certificate must be renewed before expiry. Import the new PFX, update the HTTPS binding, and verify the chain from a client that trusts the internal CA.",
    important:
      "Keep the old certificate until browsers confirm the new binding. Do not delete it from the Local Computer store mid-change.",
    prerequisites: [
      "Local admin on the IIS host",
      "New PFX and password from the internal CA",
      "Maintenance window if the site cannot tolerate a brief recycle",
    ],
    steps: [
      {
        title: "Import the PFX",
        body: "On the server, open certlm.msc → Personal → Certificates → All Tasks → Import. Place the certificate in Local Computer\\Personal and allow the private key to be exportable only if the runbook requires it.",
      },
      {
        title: "Note the new thumbprint",
        body: "Double-click the certificate → Details → Thumbprint. Copy the value without spaces.",
        code: "Get-ChildItem Cert:\\LocalMachine\\My | Where-Object Subject -like '*intranet*' | Format-List Subject,Thumbprint,NotAfter",
        language: "powershell",
      },
      {
        title: "Update the IIS HTTPS binding",
        body: "In IIS Manager, select the site → Bindings → https → Edit → select the new certificate. Confirm the host name and port 443 are unchanged.",
      },
      {
        title: "Recycle the application pool",
        body: "Recycle the site’s app pool, then browse to https://hostname from a domain-joined client.",
      },
    ],
    verification: [
      "Browser shows the new Not After date",
      "No certificate warnings on a domain-joined client",
      "netsh http show sslcert lists the new thumbprint for 0.0.0.0:443 or the site IP",
    ],
    troubleshooting: [
      {
        title: "Private key not available",
        body: "The import account may lack permission on the key container. Re-import as local admin and grant IIS AppPool identity Read on the key if required.",
      },
    ],
  }),

  procedureArticle({
    slug: "exchange-online-shared-mailbox-permissions",
    title: "Exchange Online - Granting Shared Mailbox Permissions",
    summary:
      "Add Full Access and Send As for a shared mailbox in Exchange Online and confirm Outlook autoconfiguration.",
    categorySlug: "m365",
    tagSlugs: ["exchange-online", "shared-mailbox", "email"],
    authorEmail: "sarah.kim@techbase.local",
    readingTimeMinutes: 5,
    version: "2.0",
    views: 744,
    helpful: 58,
    notHelpful: 4,
    createdAt: new Date("2026-03-18T11:00:00Z"),
    updatedAt: new Date("2026-10-12T13:00:00Z"),
    publishedAt: new Date("2026-03-20T09:00:00Z"),
    overview:
      "Shared mailboxes are the supported way for a team to read and send from a common address. Grant Full Access so Outlook automaps the mailbox, and Send As when users must appear as the shared address.",
    prerequisites: [
      "Exchange Administrator or Helpdesk role with mailbox recipient permissions",
      "Shared mailbox already created",
      "User account enabled and licensed for Outlook if they also need a primary mailbox",
    ],
    steps: [
      {
        title: "Grant Full Access",
        body: "In Exchange admin center → Recipients → Mailboxes → shared mailbox → Mailbox delegation → Full access → add the user. Leave automapping enabled unless the user already has many mailboxes.",
        code: "Add-MailboxPermission -Identity 'helpdesk@contoso.com' -User 'jdoe@contoso.com' -AccessRights FullAccess -InheritanceType All",
        language: "powershell",
      },
      {
        title: "Grant Send As when required",
        body: "Under Mailbox delegation → Send as, add the same user (or use Add-RecipientPermission).",
        code: "Add-RecipientPermission -Identity 'helpdesk@contoso.com' -Trustee 'jdoe@contoso.com' -AccessRights SendAs -Confirm:$false",
        language: "powershell",
      },
      {
        title: "Refresh Outlook",
        body: "Have the user restart Outlook or remove and re-add the profile if the shared mailbox does not appear within 15 minutes.",
      },
    ],
    verification: [
      "Shared mailbox appears in Outlook folder list",
      "Test message From the shared address succeeds",
      "Get-MailboxPermission shows the user with FullAccess",
    ],
  }),

  procedureArticle({
    slug: "dns-client-cache-and-scavenging-checks",
    title: "DNS - Client Cache Flush and Server Scavenging Checks",
    summary:
      "Clear a stale DNS client cache, verify authoritative records, and confirm scavenging settings on Windows DNS before deleting aged records.",
    categorySlug: "networking",
    tagSlugs: ["dns", "windows-server", "troubleshooting"],
    authorEmail: "raj.patel@techbase.local",
    readingTimeMinutes: 6,
    version: "1.0",
    views: 156,
    helpful: 12,
    notHelpful: 0,
    createdAt: new Date("2026-09-05T08:00:00Z"),
    updatedAt: new Date("2026-10-18T10:00:00Z"),
    publishedAt: new Date("2026-09-08T11:00:00Z"),
    overview:
      "Name resolution issues are often a stale client cache or an unexpected record on the authoritative Windows DNS server. Flush the client, query the server directly, then review scavenging only if aged dynamic records are the problem.",
    important:
      "Do not enable scavenging on a zone without confirming noStaticRecords and a safe refresh interval. Incorrect scavenging deletes valid records.",
    prerequisites: [
      "Ability to run elevated commands on the client",
      "DNS admin rights on the authoritative server for scavenging review",
    ],
    steps: [
      {
        title: "Flush and register the client",
        body: "On the affected client, flush the resolver cache and force registration.",
        code: "ipconfig /flushdns\nipconfig /registerdns\nResolve-DnsName intranet.contoso.local -Type A",
        language: "powershell",
      },
      {
        title: "Query the authoritative server",
        body: "Bypass forwarders by querying the DNS server IP that hosts the zone.",
        code: "Resolve-DnsName intranet.contoso.local -Server 10.0.0.10 -Type A",
        language: "powershell",
      },
      {
        title: "Review scavenging (server)",
        body: "In DNS Manager → server properties → Advanced, confirm scavenging is intentional. On the zone, check No-refresh and Refresh intervals before deleting stamped records.",
      },
    ],
    verification: [
      "Resolve-DnsName returns the expected A/AAAA record",
      "nslookup against the authoritative server matches the client result after flush",
    ],
  }),

  procedureArticle({
    slug: "linux-sudoers-break-glass-access",
    title: "Linux - Granting Break-Glass Sudo Access Safely",
    summary:
      "Add a time-limited sudoers drop-in for break-glass access, validate with visudo, and remove the grant after the incident.",
    categorySlug: "linux",
    tagSlugs: ["sudo", "security", "troubleshooting"],
    authorEmail: "raj.patel@techbase.local",
    readingTimeMinutes: 5,
    version: "1.3",
    views: 98,
    helpful: 11,
    notHelpful: 1,
    createdAt: new Date("2026-07-22T12:00:00Z"),
    updatedAt: new Date("2026-10-01T16:00:00Z"),
    publishedAt: new Date("2026-07-24T09:00:00Z"),
    overview:
      "When automation or the primary admin path fails, break-glass sudo must be explicit, logged, and short-lived. Prefer a drop-in file under /etc/sudoers.d instead of editing the main sudoers file.",
    important:
      "Never echo redirects into sudoers. Always use visudo -f so a syntax error cannot lock out root.",
    prerequisites: [
      "Root or existing NOPASSWD emergency access on the host",
      "Incident ticket number for the grant",
      "LDAP/AD group used for break-glass if central sudoers is normally managed by Ansible",
    ],
    steps: [
      {
        title: "Create a drop-in with visudo",
        body: "Create /etc/sudoers.d/99-breakglass with the user or group and command scope required for the incident.",
        code: "visudo -f /etc/sudoers.d/99-breakglass\n# Example line:\n# %breakglass ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl",
        language: "bash",
      },
      {
        title: "Set permissions",
        body: "Ensure the drop-in is mode 0440 and owned by root:root.",
        code: "chown root:root /etc/sudoers.d/99-breakglass\nchmod 0440 /etc/sudoers.d/99-breakglass",
        language: "bash",
      },
      {
        title: "Validate and document",
        body: "Run sudo -l as the break-glass user, attach the ticket ID in /var/log comments or your change record, and schedule removal within 24 hours.",
      },
    ],
    verification: [
      "sudo -l shows only the intended commands",
      "visudo -c reports parsed OK",
      "Removal task exists on the incident ticket",
    ],
  }),

  procedureArticle({
    slug: "print-server-clearing-stuck-jobs",
    title: "Print Server - Clearing Stuck Jobs on Windows Server",
    summary:
      "Drain a hung print queue, restart the spooler safely, and confirm clients can print again without deleting unrelated queues.",
    categorySlug: "windows",
    tagSlugs: ["print-server", "windows-server", "troubleshooting"],
    authorEmail: "joe.clark@techbase.local",
    readingTimeMinutes: 4,
    version: "1.0",
    views: 321,
    helpful: 24,
    notHelpful: 2,
    createdAt: new Date("2026-04-02T10:00:00Z"),
    updatedAt: new Date("2026-08-19T14:00:00Z"),
    publishedAt: new Date("2026-04-03T11:00:00Z"),
    overview:
      "A single corrupted spool file can block an entire shared queue. Pause the queue, clear stuck jobs for that printer only when possible, restart the Spooler service, then release the queue.",
    prerequisites: [
      "Local admin on the print server",
      "Printer share name and affected queue",
      "Change window if many users share the server",
    ],
    steps: [
      {
        title: "Pause the queue",
        body: "In Print Management, pause printing on the affected queue so new jobs do not pile onto a bad spool file.",
      },
      {
        title: "Cancel stuck jobs",
        body: "Open the queue, cancel jobs that show Error or Spooling for an extended time. If the UI hangs, stop the spooler and clear only that printer’s subfolder under Spool\\PRINTERS when documented for your farm.",
        code: "Stop-Service Spooler -Force\n# Inspect C:\\Windows\\System32\\spool\\PRINTERS before deleting files\nStart-Service Spooler",
        language: "powershell",
      },
      {
        title: "Resume and test",
        body: "Resume the queue and print a test page from a known-good client.",
      },
    ],
    verification: [
      "Test page completes",
      "Spooler service is Running",
      "No jobs remain in Error state on that queue",
    ],
  }),

  procedureArticle({
    slug: "jira-servicenow-webhook-bridge",
    title: "Integrations - Jira Webhook Bridge to ServiceNow Incidents",
    summary:
      "Configure a Jira webhook that creates or updates a ServiceNow incident, including shared secret validation and field mapping.",
    categorySlug: "integrations",
    tagSlugs: ["jira", "servicenow", "webhook"],
    authorEmail: "sarah.kim@techbase.local",
    readingTimeMinutes: 10,
    version: "1.0",
    views: 87,
    helpful: 9,
    notHelpful: 0,
    createdAt: new Date("2026-09-14T09:00:00Z"),
    updatedAt: new Date("2026-10-22T17:00:00Z"),
    publishedAt: new Date("2026-09-16T10:00:00Z"),
    overview:
      "Some teams file work in Jira while ITIL incidents live in ServiceNow. A signed webhook from Jira into a ServiceNow Scripted REST API (or IntegrationHub flow) keeps the incident number linked on the Jira issue without dual entry.",
    important:
      "Store the shared secret in the vault. Do not put production credentials in the Jira webhook URL query string.",
    prerequisites: [
      "Jira project admin for the source project",
      "ServiceNow admin for Scripted REST or Flow Designer",
      "HTTPS endpoint reachable from Atlassian Cloud or your Jira DC nodes",
    ],
    steps: [
      {
        title: "Create the ServiceNow inbound endpoint",
        body: "Publish a Scripted REST API that accepts JSON, validates an HMAC or static bearer token, and inserts/updates incident with correlation_id set to the Jira issue key.",
      },
      {
        title: "Register the Jira webhook",
        body: "In Jira → System → Webhooks, create a webhook for issue created/updated on the project. Point it at the ServiceNow URL and include the secret header your API expects.",
      },
      {
        title: "Map required fields",
        body: "Map summary → short_description, description → description, priority → impact/urgency per the conversion table in the integration wiki.",
      },
      {
        title: "Write the Jira issue link back",
        body: "Have ServiceNow return the incident number; use an automation rule or the webhook response handler to set a custom field sn_incident on the Jira issue.",
      },
    ],
    verification: [
      "Creating a sample Jira issue opens an incident in ServiceNow",
      "correlation_id matches the Jira key",
      "Invalid secret returns 401 and no incident is created",
    ],
    troubleshooting: [
      {
        title: "Webhook shows 403 from Jira",
        body: "Confirm the ServiceNow IP allowlist and that the mid-server or internet ACL allows Atlassian egress ranges.",
      },
    ],
  }),

  procedureArticle({
    slug: "ad-computer-object-cleanup",
    title: "Active Directory - Stale Computer Object Cleanup",
    summary:
      "Find computer accounts that have not signed on recently, disable them safely, and move them to a quarantine OU before deletion.",
    categorySlug: "active-directory",
    tagSlugs: ["active-directory", "maintenance", "windows-server"],
    authorEmail: "marcus.rivera@techbase.local",
    readingTimeMinutes: 7,
    version: "1.1",
    views: 205,
    helpful: 18,
    notHelpful: 1,
    createdAt: new Date("2026-02-10T09:00:00Z"),
    updatedAt: new Date("2026-10-05T12:00:00Z"),
    publishedAt: new Date("2026-02-12T10:00:00Z"),
    overview:
      "Stale computer accounts clutter GP targeting and increase attack surface. Identify objects with old pwdLastSet / lastLogonTimestamp, disable them, move to an OU that blocks sign-in, then delete after the retention window.",
    important:
      "Exclude servers, cluster objects, and gMSA-related accounts. Always export the candidate list to the change ticket before bulk disable.",
    prerequisites: [
      "Account Operators or Domain Admin equivalent for the target OUs",
      "Agreed stale threshold (commonly 90 days)",
      "Quarantine OU (e.g. OU=Disabled Computers)",
    ],
    steps: [
      {
        title: "Export candidates",
        body: "Query for enabled computer accounts older than the threshold and review the CSV.",
        code: "$limit = (Get-Date).AddDays(-90)\nGet-ADComputer -Filter {Enabled -eq $true -and PasswordLastSet -lt $limit} -Properties PasswordLastSet,LastLogonDate |\n  Select-Object Name,DistinguishedName,PasswordLastSet,LastLogonDate |\n  Export-Csv .\\stale-computers.csv -NoTypeInformation",
        language: "powershell",
      },
      {
        title: "Disable and move",
        body: "For approved rows, disable the account and move it to the quarantine OU. Do not delete on the first pass.",
        code: "Disable-ADAccount -Identity 'CN=PC-OLD01,OU=Workstations,DC=contoso,DC=local'\nMove-ADObject -Identity 'CN=PC-OLD01,OU=Workstations,DC=contoso,DC=local' -TargetPath 'OU=Disabled Computers,DC=contoso,DC=local'",
        language: "powershell",
      },
      {
        title: "Schedule deletion",
        body: "After 30 days with no restore request, delete the quarantined objects in a second change.",
      },
    ],
    verification: [
      "Candidate CSV attached to the change ticket",
      "Disabled accounts show Enabled=$false in the quarantine OU",
      "No sudden Kerberos failures for production servers (spot-check)",
    ],
  }),
];

function procedureArticle(input: {
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
  tagSlugs: string[];
  authorEmail: string;
  readingTimeMinutes: number;
  version: string;
  views: number;
  helpful: number;
  notHelpful: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  overview: string;
  important?: string;
  prerequisites: string[];
  steps: { title: string; body: string; code?: string; language?: string }[];
  verification: string[];
  troubleshooting?: { title: string; body: string }[];
  status?: ArticleStatus;
}): SeedArticle {
  const sections: SeedSection[] = [
    {
      kind: SectionKind.overview,
      title: "Overview",
      order: 0,
      blocks: [
        {
          kind: BlockKind.prose,
          order: 0,
          content: `<p>${escapeHtml(input.overview)}</p>`,
        },
        ...(input.important
          ? [
              {
                kind: BlockKind.callout,
                order: 1,
                calloutVariant: CalloutVariant.important,
                content: {
                  title: "Important",
                  body: input.important,
                },
              } satisfies SeedBlock,
            ]
          : []),
      ],
    },
    {
      kind: SectionKind.prerequisites,
      title: "Prerequisites",
      order: 1,
      blocks: [
        {
          kind: BlockKind.checklist,
          order: 0,
          content: input.prerequisites,
        },
      ],
    },
    {
      kind: SectionKind.steps,
      title: "Step-by-Step Instructions",
      order: 2,
      blocks: input.steps.reduce<SeedBlock[]>((acc, step, index) => {
        acc.push({
          kind: BlockKind.step,
          order: acc.length,
          stepNumber: index + 1,
          content: { title: step.title, body: `<p>${escapeHtml(step.body)}</p>` },
        });
        if (step.code?.trim()) {
          acc.push({
            kind: BlockKind.code,
            order: acc.length,
            language: step.language ?? "text",
            code: step.code.replace(/\r\n/g, "\n"),
          });
        }
        return acc;
      }, []),
    },
    {
      kind: SectionKind.verification,
      title: "Verification",
      order: 3,
      blocks: [
        {
          kind: BlockKind.checklist,
          order: 0,
          content: input.verification,
        },
      ],
    },
  ];

  if (input.troubleshooting?.length) {
    sections.push({
      kind: SectionKind.troubleshooting,
      title: "Troubleshooting",
      order: 4,
      blocks: input.troubleshooting.map((item, order) => ({
        kind: BlockKind.callout,
        order,
        calloutVariant: CalloutVariant.warning,
        content: { title: item.title, body: item.body },
      })),
    });
  }

  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    status: input.status ?? ArticleStatus.published,
    readingTimeMinutes: input.readingTimeMinutes,
    version: input.version,
    categorySlug: input.categorySlug,
    tagSlugs: input.tagSlugs,
    authorEmail: input.authorEmail,
    views: input.views,
    helpful: input.helpful,
    notHelpful: input.notHelpful,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    publishedAt: input.publishedAt,
    sections,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stubArticle(
  overrides: Omit<SeedArticle, "sections" | "status"> & {
    status?: ArticleStatus;
    sections?: SeedSection[];
  },
): SeedArticle {
  return {
    status: ArticleStatus.published,
    sections: [
      {
        kind: SectionKind.overview,
        title: "Overview",
        order: 0,
        blocks: [
          {
            kind: BlockKind.prose,
            order: 0,
            content: overrides.summary ?? "Article content coming soon.",
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Seeding TechBase database…");

  // Users
  const userMap = new Map<string, string>();
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: u,
    });
    userMap.set(u.email, user.id);

    const identity = await prisma.identity.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: await passwordHasher.hash(DEV_ACCOUNT_PASSWORD),
        emailVerified: new Date(),
      },
    });
    if (user.identityId !== identity.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: { identityId: identity.id },
      });
    }
  }
  console.log(`  ✅ ${USERS.length} users`);

  // Categories
  const catMap = new Map<string, string>();
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
    catMap.set(c.slug, cat.id);
  }
  console.log(`  ✅ ${CATEGORIES.length} categories`);

  // Tags
  const tagMap = new Map<string, string>();
  for (const t of TAGS) {
    const tag = await prisma.tag.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: t,
    });
    tagMap.set(t.slug, tag.id);
  }
  console.log(`  ✅ ${TAGS.length} tags`);

  // Articles
  for (const a of ARTICLES) {
    const authorId = userMap.get(a.authorEmail)!;
    const categoryId = catMap.get(a.categorySlug) ?? null;

    // Upsert the article itself
    const article = await prisma.article.upsert({
      where: { slug: a.slug },
      update: {
        title: a.title,
        summary: a.summary,
        status: a.status,
        readingTimeMinutes: a.readingTimeMinutes,
        version: a.version,
        categoryId,
        authorId,
        views: a.views,
        helpful: a.helpful,
        notHelpful: a.notHelpful,
        publishedAt: a.publishedAt,
      },
      create: {
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        status: a.status,
        readingTimeMinutes: a.readingTimeMinutes,
        version: a.version,
        categoryId,
        authorId,
        views: a.views,
        helpful: a.helpful,
        notHelpful: a.notHelpful,
        createdAt: a.createdAt,
        publishedAt: a.publishedAt,
      },
    });

    // Tags — delete existing and re-create
    await prisma.articleTag.deleteMany({ where: { articleId: article.id } });
    for (const slug of a.tagSlugs) {
      const tagId = tagMap.get(slug);
      if (tagId) {
        await prisma.articleTag.create({
          data: { articleId: article.id, tagId },
        });
      }
    }

    // Drop the version pointers first so the FK allows a clean rebuild.
    await prisma.article.update({
      where: { id: article.id },
      data: { currentVersionId: null, draftVersionId: null },
    });
    await prisma.articleVersion.deleteMany({
      where: { articleId: article.id },
    });

    const ver = await prisma.articleVersion.create({
      data: {
        articleId: article.id,
        authorId,
        version: a.version,
        title: a.title,
        summary: a.summary,
        sections: {
          create: a.sections.map((s) => ({
            kind: s.kind,
            title: s.title,
            order: s.order,
            blocks: {
              create: s.blocks.map((b) => ({
                kind: b.kind,
                order: b.order,
                content: b.content ?? undefined,
                stepNumber: b.stepNumber ?? null,
                calloutVariant: b.calloutVariant ?? null,
                language: b.language ?? null,
                code: b.code ?? null,
                imageUrl: b.imageUrl ?? null,
                imageAlt: b.imageAlt ?? null,
              })),
            },
          })),
        },
      },
    });

    // Point article at its current version
    await prisma.article.update({
      where: { id: article.id },
      data: { currentVersionId: ver.id },
    });
  }
  console.log(`  ✅ ${ARTICLES.length} articles (with sections + blocks)`);

  // Sample bell items for Joe so the notifications panel is not empty on first login.
  const joeId = userMap.get("joe.clark@techbase.local");
  if (joeId) {
    await prisma.notification.deleteMany({ where: { userId: joeId } });
    const sampleSlug = ARTICLES[0]?.slug ?? "reset-local-admin-password";
    await prisma.notification.createMany({
      data: [
        {
          userId: joeId,
          kind: "ingestion_complete",
          title: "Import finished",
          body: "Scan_To_Network_Share.docx is ready as a draft.",
          href: `/kb/${sampleSlug}/edit`,
        },
        {
          userId: joeId,
          kind: "review_requested",
          title: "Review requested",
          body: "Sarah Kim submitted “BitLocker recovery key retrieval”.",
          href: `/kb/${sampleSlug}`,
        },
        {
          userId: joeId,
          kind: "mention",
          title: "You were mentioned",
          body: "Marcus Rivera noted you on a field note. Mentions wire up later.",
          href: `/kb/${sampleSlug}`,
          readAt: new Date(),
        },
      ],
    });
    console.log("  ✅ sample notifications for Joe Clark");
  }

  console.log("🌱 Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

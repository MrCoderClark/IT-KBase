/**
 * Prisma seed — creates users, categories, tags, and 11 realistic IT articles
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
];

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

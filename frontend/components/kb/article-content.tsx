import type { Article, Block, Section } from "@/lib/types/article";
import { SectionIcon } from "@/components/kb/section-icon";
import { Callout } from "@/components/kb/callout";
import { CodeBlock } from "@/components/kb/code-block";
import { StepBadge } from "@/components/kb/step-badge";
import { Checklist } from "@/components/kb/checklist";

/**
 * Main content column — renders every section and its blocks in order.
 *
 * Each section heading gets an `id` matching the TOC anchors and a
 * `scroll-margin-top` so the sticky top bar doesn't cover it.
 */
export function ArticleContent({ article }: { article: Article }) {
  return (
    <div className="min-w-0 flex-1">
      {article.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </div>
  );
}

function SectionRenderer({ section }: { section: Section }) {
  const isSteps = section.kind === "steps";

  return (
    <section className="mb-10" aria-labelledby={`heading-${section.id}`}>
      {/* Section heading with icon tile */}
      <div
        id={section.id}
        className="mb-5 flex items-center gap-3"
        style={{ scrollMarginTop: 96 }}
      >
        <SectionIcon kind={section.kind} />
        <h2
          id={`heading-${section.id}`}
          className="text-[20px] leading-7 font-semibold text-fg"
        >
          {section.title}
        </h2>
      </div>

      {/* Blocks */}
      <div className="flex flex-col gap-4">
        {section.blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            indentNonStep={isSteps}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * @param indentNonStep — when true, non-step blocks (code, prose) are
 *   left-indented by the step badge width (28 + 16 gap = 44px) so they
 *   visually align under step body text rather than the badge.
 */
function BlockRenderer({
  block,
  indentNonStep = false,
}: {
  block: Block;
  indentNonStep?: boolean;
}) {
  const indent = indentNonStep && block.kind !== "step";

  const wrapIndent = (node: React.ReactNode) =>
    indent ? <div className="pl-[44px]">{node}</div> : node;

  switch (block.kind) {
    case "prose":
      return wrapIndent(
        <div
          className="article-prose text-[15px] leading-6 text-fg"
          dangerouslySetInnerHTML={{ __html: block.content }}
        />,
      );

    case "step":
      return (
        <div className="flex gap-4">
          <StepBadge number={block.stepNumber} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] leading-6 font-semibold text-fg">
              {block.title}
            </h3>
            {block.content && (
              <div
                className="article-prose mt-2 text-[15px] leading-6 text-fg"
                dangerouslySetInnerHTML={{ __html: block.content }}
              />
            )}
          </div>
        </div>
      );

    case "callout":
      return wrapIndent(
        <Callout variant={block.variant} title={block.title}>
          <span dangerouslySetInnerHTML={{ __html: block.content }} />
        </Callout>,
      );

    case "code":
      return wrapIndent(
        <CodeBlock code={block.code} language={block.language} />,
      );

    case "checklist":
      return wrapIndent(<Checklist items={block.items} />);

    case "image":
      return wrapIndent(
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.imageUrl}
            alt={block.imageAlt}
            className="rounded-lg"
          />
        </figure>,
      );

    default:
      return null;
  }
}

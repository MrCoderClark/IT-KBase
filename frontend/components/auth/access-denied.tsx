export function AccessDenied({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[560px] px-6 py-16">
      <h1 className="text-[22px] leading-7 font-bold tracking-tight text-fg">{title}</h1>
      <p className="mt-2 text-[14px] leading-6 text-fg-muted">{detail}</p>
    </div>
  );
}

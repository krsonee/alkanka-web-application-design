export function ShelfCard({
  image,
  title,
  line,
  text,
  action,
}: {
  image?: string | null;
  title: string;
  line?: string;
  text?: string;
  action?: React.ReactNode;
}) {
  const src = image?.trim() ?? "";
  return (
    <article className="card-surface flex flex-col overflow-hidden rounded-xl">
      <div className="flex h-16 items-center justify-center bg-[#0d1220] px-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-10 w-[78%] object-contain" />
        ) : (
          <span className="line-clamp-2 text-center text-sm font-black leading-tight text-white">{title}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="text-center text-sm font-extrabold text-white">{title}</div>
        {line ? <p className="text-center text-xs font-black leading-snug text-[#f2c94c]">{line}</p> : null}
        {text ? <p className="line-clamp-3 text-center text-xs leading-relaxed text-[#b8c0d4]">{text}</p> : null}
        {action ? <div className="mt-auto pt-1">{action}</div> : null}
      </div>
    </article>
  );
}

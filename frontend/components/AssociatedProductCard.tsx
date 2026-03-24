"use client";

import MaterialIcon from "@/components/MaterialIcon";

interface AssociatedProductCardProps {
  product?: {
    title?: string | null;
    firstImageUrl?: string | null;
    frontendUrl?: string | null;
  } | null;
  productTitle?: string | null;
  productHandle?: string | null;
}

export default function AssociatedProductCard({ product, productTitle, productHandle }: AssociatedProductCardProps) {
  const title = product?.title || productTitle || "Product";
  const frontendUrl = product?.frontendUrl?.trim() || null;
  const firstImageUrl = product?.firstImageUrl?.trim() || null;
  const fallbackPath = productHandle ? `/products/${productHandle}` : "Product URL unavailable";

  const content = (
    <>
      {firstImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={firstImageUrl}
          alt={title}
          className="h-14 w-14 rounded-lg object-cover border border-stone-200 dark:border-zinc-700"
        />
      ) : (
        <div className="h-14 w-14 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-400 dark:text-zinc-500">
          <MaterialIcon name="image" className="text-xl" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900 dark:text-zinc-100 truncate">{title}</p>
        <p className="text-xs text-stone-500 dark:text-zinc-400 truncate">
          {frontendUrl || fallbackPath}
        </p>
      </div>
      {frontendUrl && (
        <MaterialIcon name="open_in_new" className="text-stone-400 dark:text-zinc-500 group-hover:text-teal-600 dark:group-hover:text-teal-400" />
      )}
    </>
  );

  if (frontendUrl) {
    return (
      <a
        href={frontendUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 hover:border-teal-400 dark:hover:border-teal-500 transition-colors"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
      {content}
    </div>
  );
}

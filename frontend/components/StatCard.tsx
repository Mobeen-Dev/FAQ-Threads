import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
  href?: string;
}

export default function StatCard({ title, value, icon, color = "bg-teal-500", href }: StatCardProps) {
  const content = (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500 dark:text-zinc-400">{title}</p>
          <p className="text-3xl font-bold mt-1 text-stone-900 dark:text-zinc-100">{value}</p>
        </div>
        <div className={`${color} text-white p-3 rounded-xl text-2xl`}>
          <MaterialIcon name={icon} className="text-[1.5rem]" />
        </div>
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="block rounded-2xl hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {content}
    </Link>
  );
}

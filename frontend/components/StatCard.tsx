interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
}

export default function StatCard({ title, value, icon, color = "bg-teal-500" }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500 dark:text-zinc-400">{title}</p>
          <p className="text-3xl font-bold mt-1 text-stone-900 dark:text-zinc-100">{value}</p>
        </div>
        <div className={`${color} text-white p-3 rounded-xl text-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

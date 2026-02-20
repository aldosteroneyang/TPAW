import Link from 'next/link';

const tabs = [
  { href: '/input', label: 'Input' },
  { href: '/results', label: 'Results' },
  { href: '/sensitivity', label: 'Sensitivity' }
];

export function NavTabs() {
  return (
    <nav className="mb-6 flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:border-slate-400"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

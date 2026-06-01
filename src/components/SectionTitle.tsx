import React from 'react';

type Props = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
};

export default function SectionTitle({ icon, title, subtitle }: Props) {
  return (
    <div className="px-5 py-4 border-b border-[#1b2230] bg-[#121722]/50 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="font-semibold text-sm tracking-wide text-gray-200">{title}</h2>
      </div>
      {subtitle ? <span className="text-xs text-gray-500">{subtitle}</span> : null}
    </div>
  );
}

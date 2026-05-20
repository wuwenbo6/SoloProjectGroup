import { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface CardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
}

export function Card({ title, icon, children, defaultCollapsed = false }: CardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-amber-600">{icon}</span>}
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </div>
        <span className="text-gray-500">
          {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </span>
      </button>
      <div
        className={`transition-all duration-300 overflow-hidden ${
          isCollapsed ? 'max-h-0' : 'max-h-[2000px]'
        }`}
      >
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

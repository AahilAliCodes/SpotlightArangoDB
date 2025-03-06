import { LampDesk } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { cn } from '@/lib/utils';

export default function Logo({
    fontSize = "text-9xl",
    iconSize = 90,
}: {
    fontSize?: string;
    iconSize?: number;
}): React.JSX.Element {
  return (
    <Link href="/" className={cn("text-8xl font-extrabold flex items-center gap-4", fontSize)}> 
      <div className="rounded-xl bg-gradient-to-r from-green-400 to-green-800 p-2.5">
        <LampDesk size={iconSize} className="stroke-white stroke-[2]" />
      </div>
      <div>
        <span>Sp</span>
        <span className="relative">
          <span className="bg-gradient-to-r from-green-400 to-green-800 bg-clip-text text-transparent">o</span>
        </span>
        <span>tlight</span>
      </div>
    </Link>
  );
}
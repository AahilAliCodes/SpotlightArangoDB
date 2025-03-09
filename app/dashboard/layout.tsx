import { UserButton, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[1500px] bg-gray-900 text-white overflow-y-auto">
      <header className="p-6 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 z-10">
        <div className="flex items-center">
          <div className="text-3xl font-bold mr-8">
            <span>Sp</span>
            <span className="relative">
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">o</span>
            </span>
            <span>tlight</span>
          </div>
          
          {/* Navigation Buttons */}
          <div className="hidden md:flex space-x-4">
            <Link href="/dashboard/agents">
              <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
                Workflows
              </button>
            </Link>
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Funding
            </button>
            <Link href="/dashboard/analytics">
              <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
                Analytics
              </button>
            </Link>
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Documents
            </button>
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Tasks
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Sign Out Button */}
          <SignOutButton>
            <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
              Sign Out
            </button>
          </SignOutButton>
          
          {/* User Profile Button */}
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>
      
      {/* Content area - renders the children */}
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}

export default Layout;

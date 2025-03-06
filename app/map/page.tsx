'use client';

// Corrected import path based on your project structure
import DashboardLayout from '@/app/(dashboard)/layout';
import Earth3D from '@/components/Earth3d'; // Match the exact case of the filename

export default function MapPage() {
  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <Earth3D />
      </div>
    </DashboardLayout>
  );
}
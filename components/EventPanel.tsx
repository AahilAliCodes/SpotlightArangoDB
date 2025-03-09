import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import EventItem from './EventItem';

const EventPanel: React.FC = () => {
  return (
    <div className="w-1/4 h-full p-4 overflow-auto">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>Real-time events and changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="Camera Position Updated" 
              time="2 minutes ago" 
              description="Camera view changed to North America."
              type="update"
            />
            <EventItem 
              title="Map Initialized" 
              time="5 minutes ago" 
              description="3D Earth visualization successfully loaded."
              type="info"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
            <EventItem 
              title="San Francisco Marker Added" 
              time="Just now" 
              description="New marker for San Francisco was placed on the map."
              type="add"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventPanel;
import React from 'react';

// Define the event types
type EventType = 'add' | 'update' | 'remove' | 'info';

// Define the props interface for the EventItem component
interface EventItemProps {
  title: string;
  time: string;
  description: string;
  type: EventType;
}

const EventItem: React.FC<EventItemProps> = ({ title, time, description, type }) => {
  const typeColors = {
    add: "text-green-500",
    update: "text-blue-500",
    remove: "text-red-500",
    info: "text-gray-500"
  };
  
  const typeIcons = {
    add: "○",
    update: "↻",
    remove: "✕",
    info: "ℹ"
  };

  return (
    <div className="border-l-2 pl-3 py-1" style={{ borderColor: typeColors[type].replace('text', 'border') }}>
      <div className="flex justify-between">
        <h4 className={`font-medium ${typeColors[type]}`}>
          <span className="mr-2">{typeIcons[type]}</span>
          {title}
        </h4>
        <span className="text-xs text-gray-400">{time}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
};

export default EventItem;
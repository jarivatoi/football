import React from 'react';
import { TrendingUp, Clock, PlayCircle, Calendar } from 'lucide-react';
import { TotelepepMatch } from '../services/totelepepService';

interface StatsCardsProps {
  matches: TotelepepMatch[];
}

const StatsCards: React.FC<StatsCardsProps> = ({ matches }) => {
  const totalMatches = matches.length;
  const liveMatches = matches.filter(m => m.status === 'live').length;
  const upcomingMatches = matches.filter(m => m.status === 'upcoming').length;
  
  // Calculate matches for today
  const today = new Date().toISOString().split('T')[0];
  const todayMatches = matches.filter(m => m.date === today).length;

  const stats = [
    {
      title: 'Total Matches',
      value: totalMatches,
      icon: TrendingUp,
      color: 'blue',
    },
    {
      title: 'Live Now',
      value: liveMatches,
      icon: PlayCircle,
      color: 'red',
    },
    {
      title: 'Upcoming',
      value: upcomingMatches,
      icon: Clock,
      color: 'yellow',
    },
    {
      title: 'Today',
      value: todayMatches,
      icon: Calendar,
      color: 'green',
    },
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50 text-blue-600';
      case 'red':
        return 'bg-red-50 text-red-600';
      case 'yellow':
        return 'bg-yellow-50 text-yellow-600';
      case 'green':
        return 'bg-green-50 text-green-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.title} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${getColorClasses(stat.color)}`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
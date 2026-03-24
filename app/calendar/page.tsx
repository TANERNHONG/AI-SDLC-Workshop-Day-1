'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSingaporeNow } from '@/lib/timezone';

interface Todo {
  id: number;
  title: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  completed: boolean;
}

interface Holiday {
  id: number;
  date: string;
  name: string;
  year: number;
}

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  todos: Todo[];
  holidays: Holiday[];
}

function CalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentDate, setCurrentDate] = useState<Date>(getSingaporeNow());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Parse month from URL or use current
    const monthParam = searchParams.get('month');
    if (monthParam) {
      const [year, month] = monthParam.split('-').map(Number);
      setCurrentDate(new Date(year, month - 1, 1));
    }

    fetchTodos();
    fetchHolidays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    // Update URL when month changes
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    router.push(`/calendar?month=${year}-${month}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  async function fetchTodos() {
    try {
      const res = await fetch('/api/todos');
      if (res.ok) {
        const data = await res.json();
        setTodos(data);
      }
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHolidays() {
    try {
      const year = currentDate.getFullYear();
      const res = await fetch(`/api/holidays?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setHolidays(data);
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    }
  }

  function generateCalendar(): DayCell[] {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from Sunday of the first week
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // End on Saturday of the last week
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    const days: DayCell[] = [];
    const currentDay = new Date(startDate);
    const today = getSingaporeNow();
    today.setHours(0, 0, 0, 0);
    
    while (currentDay <= endDate) {
      const dateStr = currentDay.toISOString().split('T')[0];
      
      // Find todos for this date
      const dayTodos = todos.filter(todo => {
        if (!todo.due_date) return false;
        const todoDate = new Date(todo.due_date).toISOString().split('T')[0];
        return todoDate === dateStr;
      });
      
      // Find holidays for this date
      const dayHolidays = holidays.filter(h => h.date === dateStr);
      
      days.push({
        date: new Date(currentDay),
        isCurrentMonth: currentDay.getMonth() === month,
        isToday: currentDay.toDateString() === today.toDateString(),
        isWeekend: currentDay.getDay() === 0 || currentDay.getDay() === 6,
        todos: dayTodos,
        holidays: dayHolidays,
      });
      
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    return days;
  }

  function navigateMonth(direction: 'prev' | 'next') {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
    fetchHolidays();
  }

  function goToToday() {
    setCurrentDate(getSingaporeNow());
    fetchHolidays();
  }

  function handleDayClick(day: DayCell) {
    if (day.todos.length > 0 || day.holidays.length > 0) {
      setSelectedDay(day);
    }
  }

  const calendarDays = generateCalendar();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const priorityColors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#3b82f6',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--page-bg)' }}>
        <p>Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8" style={{
      backgroundColor: 'var(--page-bg)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Calendar</h1>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-lg font-medium text-white transition-all hover:shadow-md"
            style={{ backgroundColor: 'var(--accent-neutral)' }}
          >
            ← Back to Todos
          </button>
        </div>

        {/* Navigation */}
        <div className="rounded-2xl shadow-lg p-6 mb-6" style={{ backgroundColor: 'var(--card-bg)' }}>
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigateMonth('prev')}
              className="px-4 py-2 rounded-lg font-medium transition-all hover:shadow-md"
              style={{ backgroundColor: 'var(--filter-bg)', color: 'var(--text-muted)' }}
            >
              ← Previous
            </button>
            
            <button
              onClick={goToToday}
              className="px-6 py-2 rounded-lg font-medium text-white transition-all hover:shadow-md"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              Today
            </button>
            
            <button
              onClick={() => navigateMonth('next')}
              className="px-4 py-2 rounded-lg font-medium transition-all hover:shadow-md"
              style={{ backgroundColor: 'var(--filter-bg)', color: 'var(--text-muted)' }}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="rounded-2xl shadow-lg p-6" style={{ backgroundColor: 'var(--card-bg)' }}>
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {dayHeaders.map((day) => (
              <div
                key={day}
                className="text-center font-semibold py-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => (
              <div
                key={index}
                onClick={() => handleDayClick(day)}
                className={`min-h-24 p-2 rounded-lg border transition-all ${
                  day.todos.length > 0 || day.holidays.length > 0 ? 'cursor-pointer hover:shadow-md' : ''
                }`}
                style={{
                  backgroundColor: day.isToday 
                    ? '#dbeafe' 
                    : day.isWeekend 
                      ? '#f9fafb' 
                      : '#ffffff',
                  borderColor: day.isToday ? '#3b82f6' : '#e2e8f0',
                  borderWidth: day.isToday ? '2px' : '1px',
                  opacity: day.isCurrentMonth ? 1 : 0.4,
                }}
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={`text-sm font-medium ${day.isToday ? 'font-bold' : ''}`}
                    style={{ color: day.isToday ? '#3b82f6' : '#2d3748' }}
                  >
                    {day.date.getDate()}
                  </span>
                  
                  {day.todos.length > 0 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      {day.todos.length}
                    </span>
                  )}
                </div>

                {/* Holidays */}
                {day.holidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="text-xs px-1.5 py-0.5 rounded mb-1 truncate"
                    style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                    title={holiday.name}
                  >
                    🎉 {holiday.name}
                  </div>
                ))}

                {/* Todos Preview */}
                {day.todos.slice(0, 2).map((todo) => (
                  <div
                    key={todo.id}
                    className="text-xs px-1.5 py-0.5 rounded mb-1 truncate"
                    style={{
                      backgroundColor: priorityColors[todo.priority] + '20',
                      borderLeft: `3px solid ${priorityColors[todo.priority]}`,
                      color: 'var(--text-body)'
                    }}
                    title={todo.title}
                  >
                    {todo.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--card-bg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {selectedDay.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h2>
                {selectedDay.holidays.length > 0 && (
                  <p className="text-sm mt-1" style={{ color: '#92400e' }}>
                    🎉 {selectedDay.holidays.map(h => h.name).join(', ')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Todos List */}
            {selectedDay.todos.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg" style={{ color: 'var(--text-muted)' }}>
                  Tasks ({selectedDay.todos.length})
                </h3>
                {selectedDay.todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="p-4 rounded-lg border"
                    style={{
                      borderColor: 'var(--border-color)',
                      borderLeftWidth: '4px',
                      borderLeftColor: priorityColors[todo.priority]
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {todo.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: priorityColors[todo.priority] + '20',
                              color: priorityColors[todo.priority]
                            }}
                          >
                            {todo.priority}
                          </span>
                          {todo.completed && (
                            <span className="text-xs" style={{ color: '#10b981' }}>
                              ✓ Completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#9ca3af' }}>No tasks for this day</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading calendar...</div>}>
      <CalendarContent />
    </Suspense>
  );
}

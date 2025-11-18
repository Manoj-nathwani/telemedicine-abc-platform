import { useState } from 'react';
import { now, formatDateOnly, isSameDay, addDays } from '../utils/dateTime';

export function useDateSelector(initialDate?: Date) {
  const [currentDate, setCurrentDate] = useState(() => 
    initialDate || now()
  );

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? addDays(currentDate, -1) : addDays(currentDate, 1);
    setCurrentDate(newDate);
  };

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const getDateString = () => {
    return formatDateOnly(currentDate);
  };

  const isTodayDate = () => {
    return isSameDay(currentDate, now());
  };

  return {
    currentDate,
    setCurrentDate,
    navigateDay,
    handleDateChange,
    getDateString,
    isToday: isTodayDate
  };
} 
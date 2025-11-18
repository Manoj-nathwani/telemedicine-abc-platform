import React, { useEffect } from 'react';
import { Button, ButtonGroup, Form } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from './PageHeader';
import { useDateSelector } from '../hooks/useDateSelector';
import { startOfDay, now, formatDateOnly, isSameDay, addDays, parse, isPast, fromDate } from '../utils/dateTime';

interface DatePageWrapperProps {
  title: string;
  children: (dateState: {
    currentDate: Date;
    getDateString: () => string;
  }) => React.ReactNode;
}

export function DatePageWrapper({ 
  title, 
  children
}: DatePageWrapperProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get date from URL or use today (configured timezone)
  const urlDate = searchParams.get('date');
  const todayDate = startOfDay(now());
  // Use fromDate to parse URL date in configured timezone, not browser timezone
  const initialDate = urlDate ? fromDate(urlDate) : todayDate;
  
  const { currentDate, handleDateChange, getDateString } = useDateSelector(initialDate);
  
  // Always use the 'date' param; if missing or in the past, set to today
  useEffect(() => {
    const currentToday = startOfDay(now());
    
    if (!urlDate) {
      // No date in URL - set to today
      const todayString = formatDateOnly(currentToday);
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('date', todayString);
      setSearchParams(newSearchParams, { replace: true });
      return;
    }
    
    // Use fromDate to parse URL date in configured timezone, not browser timezone
    const urlDateObj = fromDate(urlDate);
    const urlDateStart = startOfDay(urlDateObj);
    
    // If URL date is in the past (before today), redirect to today
    if (isPast(urlDateStart) && !isSameDay(urlDateStart, currentToday)) {
      const todayString = formatDateOnly(currentToday);
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('date', todayString);
      setSearchParams(newSearchParams, { replace: true });
      return;
    }
    
    // URL date is valid - sync with currentDate if needed
    if (!isSameDay(urlDateObj, currentDate)) {
      handleDateChange(urlDateObj);
    }
  }, [urlDate, currentDate, handleDateChange, searchParams, setSearchParams]);

  const updateDateInUrl = (newDate: Date) => {
    const dateString = formatDateOnly(newDate);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('date', dateString);
    setSearchParams(newSearchParams);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? addDays(currentDate, -1) : addDays(currentDate, 1);
    handleDateChange(newDate);
    updateDateInUrl(newDate);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Use fromDate to parse date input in configured timezone, not browser timezone
    const newDate = fromDate(e.target.value);
    handleDateChange(newDate);
    updateDateInUrl(newDate);
  };

  const onTitleClick = () => {
    handleDateChange(todayDate);
    updateDateInUrl(todayDate);
  };

  return (
    <>
      <PageHeader 
        title={title}
        onTitleClick={onTitleClick}
      >
        <ButtonGroup>
          <Button
            variant="light"
            size="sm"
            onClick={() => navigateDay('prev')}
            title="Previous day"
          >
            ←
          </Button>
          <Form.Control
            type="date"
            value={formatDateOnly(currentDate)}
            onChange={handleDateInputChange}
            onKeyDown={(e) => e.preventDefault()}
            className="rounded-0 border-secondary-subtle border-start-0 border-end-0"
            title="Select date"
          />
          <Button
            variant="light"
            size="sm"
            onClick={() => navigateDay('next')}
            title="Next day"
          >
            →
          </Button>
        </ButtonGroup>
      </PageHeader>
      {children({ currentDate, getDateString })}
    </>
  );
} 
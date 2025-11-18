import React, { useState, useEffect, useMemo } from 'react';
import { useAction, useQuery } from 'wasp/client/operations';
import { bulkUpdateSlots } from 'wasp/client/operations';
import { getSlotsByDate } from 'wasp/client/operations';
import { Offcanvas, Button, Alert } from 'react-bootstrap';
import { Loading } from '..';
import { toTimeInput, formatDateOnly, now, isSameDay, isAfter, fromDateTime } from '../../utils/dateTime';
import { useConfig } from '../../contexts/ConfigContext';

interface EditAvailabilityOffcanvasProps {
  show: boolean;
  onHide: () => void;
  currentDate: Date;
  userId: number;
  onSuccess?: () => void;
}

interface ExistingSlot {
  id: number;
  startDateTime: Date;
  endDateTime: Date;
  consultation: {
    id: number;
    status: string;
    consultationRequest: {
      phoneNumber: string;
      description: string;
    };
  } | null;
}

export function EditAvailabilityOffcanvas({ show, onHide, currentDate, userId, onSuccess }: EditAvailabilityOffcanvasProps) {
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulkUpdateSlotsFn = useAction(bulkUpdateSlots);
  const currentDateKey = formatDateOnly(currentDate);

  const config = useConfig();
  const { consultationDurationMinutes, breakDurationMinutes } = config;

  // Get existing slots for this date and user
  const { data: existingSlots, isLoading, error: slotsError } = useQuery(getSlotsByDate, {
    date: currentDateKey,
    userId: userId
  });

  // Initialize selectedSlots from database (only available slots)
  useEffect(() => {
    if (existingSlots) {
      const availableSlots = new Set<string>();

      existingSlots.forEach((slotItem: ExistingSlot) => {
        // Only include slots that don't have consultations (available slots)
        if (!slotItem.consultation) {
          // Convert database timestamp fields to local time strings for display
          const startTime = toTimeInput(slotItem.startDateTime);
          const endTime = toTimeInput(slotItem.endDateTime);
          const slotKey = `${startTime}-${endTime}`;
          availableSlots.add(slotKey);
        }
      });

      setSelectedSlots(availableSlots);
    }
  }, [existingSlots]);

  // Reset when date or user changes
  useEffect(() => {
    setSelectedSlots(new Set());
  }, [currentDateKey, userId]);

  // Determine if currentDate is today - recalculate when component opens or date changes
  // Use a fresh now() each time to ensure accurate comparison
  const isToday = useMemo(() => {
    const currentNow = now();
    const result = isSameDay(currentDate, currentNow);
    return result;
  }, [currentDate, currentDateKey]); // Recalculate when date changes

  // Generate all possible time slots using configuration
  const generateTimeSlots = () => {
    const slots: string[] = [];
    const totalSlotDuration = consultationDurationMinutes + breakDurationMinutes;

    // Generate slots in 24-hour format
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += totalSlotDuration) {
        // Create time slot timestamps
        const startTime = hour.toString().padStart(2, '0') + ':' + minute.toString().padStart(2, '0');
        const endMinute = minute + consultationDurationMinutes;
        const endHour = endMinute >= 60 ? hour + 1 : hour;
        const endMin = endMinute >= 60 ? endMinute - 60 : endMinute;
        const endTime = endHour.toString().padStart(2, '0') + ':' + endMin.toString().padStart(2, '0');
        const slotKey = `${startTime}-${endTime}`;

        // Only filter out past slots if currentDate is today
        if (isToday) {
          // Create a timestamp for this slot today using fromDateTime to ensure correct timezone handling
          const slotDateTime = fromDateTime(currentDateKey, startTime);
          // Only include slots that start strictly in the future (after now)
          // Call now() fresh for each comparison to ensure accuracy
          if (isAfter(slotDateTime, now())) {
            slots.push(slotKey);
          }
        } else {
          slots.push(slotKey);
        }
      }
    }
    return slots;
  };

  // Memoize time slots to recalculate when date or config changes
  const timeSlots = useMemo(() => generateTimeSlots(), [isToday, currentDateKey, consultationDurationMinutes, breakDurationMinutes]);

  // Check if slot is booked
  const isBooked = (slotId: string) => {
    if (!existingSlots) return false;
    return existingSlots.some((slotItem: ExistingSlot) => {
      // Convert database timestamp fields to local time strings for comparison
      const startTime = toTimeInput(slotItem.startDateTime);
      const endTime = toTimeInput(slotItem.endDateTime);
      const slotKey = `${startTime}-${endTime}`;
      return slotKey === slotId && slotItem.consultation !== null;
    });
  };

  // Simple click handler
  const handleSlotClick = (slotId: string) => {
    if (isBooked(slotId)) return; // Can't click booked slots

    setSelectedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slotId)) {
        newSet.delete(slotId);
      } else {
        newSet.add(slotId);
      }
      return newSet;
    });
  };

  // Check if all slots for an hour are selected
  const isHourSelected = (hour: number) => {
    const hourSlots = timeSlots.filter(slotId => {
      const [startTime] = slotId.split('-');
      if (!startTime) return false;
      const hourPart = startTime.split(':')[0];
      return hourPart ? parseInt(hourPart) === hour : false;
    });

    if (hourSlots.length === 0) return false;

    return hourSlots.every(slotId => {
      if (isBooked(slotId)) return true; // Booked slots are considered "selected"
      return selectedSlots.has(slotId);
    });
  };

  // Toggle all slots for an hour
  const handleHourToggle = (hour: number) => {
    const hourSlots = timeSlots.filter(slotId => {
      const [startTime] = slotId.split('-');
      if (!startTime) return false;
      const hourPart = startTime.split(':')[0];
      return hourPart ? parseInt(hourPart) === hour : false;
    });

    const allSelected = isHourSelected(hour);

    setSelectedSlots(prev => {
      const newSet = new Set(prev);

      hourSlots.forEach(slotId => {
        if (isBooked(slotId)) return; // Skip booked slots

        if (allSelected) {
          newSet.delete(slotId);
        } else {
          newSet.add(slotId);
        }
      });

      return newSet;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const slotsToCreate = Array.from(selectedSlots).map(slotId => {
        const [startTime, endTime] = slotId.split('-');
        
        if (!startTime || !endTime) {
          throw new Error(`Invalid slot ID format: ${slotId}`);
        }
        
        // The action will handle converting these time strings to full timestamps
        return { startTime, endTime };
      });

      await bulkUpdateSlotsFn({
        date: currentDateKey,
        userId: userId,
        slots: slotsToCreate
      });

      onHide();
      setSelectedSlots(new Set());
      onSuccess?.();
    } catch (err: any) {
      setError('Error saving availability: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Offcanvas show={show} onHide={onHide} placement="end" size="lg">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Edit Availability</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <div className="text-center"><Loading /></div>
        </Offcanvas.Body>
      </Offcanvas>
    );
  }

  if (slotsError) {
    return (
      <Offcanvas show={show} onHide={onHide} placement="end" size="lg">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Edit Availability</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Alert variant="danger">Error loading slots: {slotsError.message}</Alert>
        </Offcanvas.Body>
      </Offcanvas>
    );
  }

  return (
    <Offcanvas show={show} onHide={onHide} placement="end" size="lg">
      <Offcanvas.Header className="d-flex justify-content-between align-items-center">
        <Offcanvas.Title className="mb-0">Edit Availability</Offcanvas.Title>
        <div className="d-flex gap-2 align-items-center">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
          <button
            type="button"
            className="btn-close"
            onClick={onHide}
            disabled={isSubmitting}
            aria-label="Close"
          />
        </div>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        <div className="mb-3">
          <div className="mb-4">
            <p className="mb-0 text-muted">Consultations are {consultationDurationMinutes}mins long with a {breakDurationMinutes}mins break in between to complete clinical notes</p>
          </div>

          {Array.from({ length: 24 }, (_, hour) => {
            const hourSlots = timeSlots.filter(slotId => {
              const [startTime] = slotId.split('-');
              if (!startTime) return false;
              const hourPart = startTime.split(':')[0];
      return hourPart ? parseInt(hourPart) === hour : false;
            });

            if (hourSlots.length === 0) return null;

            return (
              <div key={hour} className="mb-3">
                <div
                  className="d-flex align-items-center mb-2 cursor-pointer"
                  onClick={() => handleHourToggle(hour)}
                  title="Select/deselect all slots for this hour"
                  style={{ cursor: 'pointer' }}
                >
                  <h6 className="text-muted mb-0 me-2">{hour.toString().padStart(2, '0')}:00</h6>
                  <div className="text-muted">
                    <i className={`bi ${isHourSelected(hour) ? 'bi-check-square-fill text-primary' : 'bi-square'} opacity-25`}></i>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-1">
                  {hourSlots.map((slotId) => {
                    const [startTime, endTime] = slotId.split('-');
                    const isBookedSlot = isBooked(slotId);
                    const isSelected = selectedSlots.has(slotId);

                    let bgClass = 'bg-light';
                    let cursorClass = 'cursor-pointer';
                    let displayText = `${startTime} - ${endTime}`;

                    if (isBookedSlot) {
                      bgClass = 'bg-secondary text-white';
                      cursorClass = 'cursor-not-allowed';
                      displayText = 'Booked 🔒';
                    } else if (isSelected) {
                      bgClass = 'bg-primary text-white';
                    }

                    return (
                      <div
                        key={slotId}
                        className={`border rounded ${bgClass} ${cursorClass}`}
                        style={{
                          minHeight: '32px',
                          minWidth: '90px',
                          userSelect: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px 8px',
                          fontSize: '0.75rem'
                        }}
                        onClick={() => handleSlotClick(slotId)}
                        title={isBookedSlot ? `${startTime} - ${endTime} - Already booked` : `${startTime} - ${endTime}`}
                      >
                        <small className="text-center">
                          {displayText}
                        </small>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Offcanvas.Body>
    </Offcanvas>
  );
} 
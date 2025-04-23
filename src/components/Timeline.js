import React, { useState, useRef, useContext, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useTimeline } from '../context/TimelineContext';

const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const TimelineContainer = styled.div`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
  padding: 10px;
  pointer-events: auto;
  opacity: ${props => props.show ? 1 : 0};
  visibility: ${props => props.show ? 'visible' : 'hidden'};
  transition: opacity 0.3s ease, visibility 0.3s ease;
`;

const TimelineContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const TimelineLine = styled.div`
  height: 2px;
  background-color: #ccc;
  flex-grow: 0.2;
  margin: 0 4px;
`;

const Dot = styled.div`
  width: 12px;
  height: 12px;
  background: ${props => props.hasData ? '#007bff' : '#333'};
  border-radius: 50%;
  margin: 0 5px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
  position: relative;

  &.entering {
    animation: ${pulse} 0.3s ease-out forwards;
  }

  &:hover {
    transform: scale(1.5);
    background: ${props => props.hasData ? '#007bff' : '#333'};
  }
`;

const DateLabel = styled.div`
  font-size: 12px;
  color: #333;
  font-weight: 500;
  white-space: nowrap;
  min-width: 50px;
  flex-shrink: 0;
`;

const HoverDate = styled.div`
  position: absolute;
  top: -35px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.95);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 3;

  ${Dot}:hover & {
    opacity: 1;
  }
`;

const ScrollButton = styled.button`
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-50%) scale(1.1);
  }
  
  &:active {
    transform: translateY(-50%) scale(0.95);
  }
  
  &:first-of-type {
    left: 5px;
  }
  
  &:last-of-type {
    right: 5px;
  }
`;

const TimelineWrapper = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
  padding: 0 30px;
`;

const TimelineItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 8px;
  cursor: pointer;
`;

const TimelineDot = styled.div`
  width: 12px;
  height: 12px;
  background-color: ${props => props.active ? '#007bff' : '#333'};
  border-radius: 50%;
  margin-bottom: 8px;
  transition: transform 0.2s ease, background-color 0.2s ease;

  &:hover {
    transform: scale(1.5);
    background-color: #007bff;
  }
`;

const Timeline = ({ availableDates }) => {
  const { showTimeline, selectedIndex, setSelectedIndex } = useTimeline();
  const [dates, setDates] = useState([]);
  const dots = Array(30).fill(null);  // 30 days
  const [currentIndex, setCurrentIndex] = useState(dots.length - 21);  // Start at the end to show most recent dates
  const contentRef = useRef(null);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 29);  // Start 29 days ago
  const endDate = new Date();  // Today

  useEffect(() => {
    const today = new Date();
    const newDates = [];
    for (let i = 0; i < 21; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      newDates.push(date);
    }
    setDates(newDates);
  }, [availableDates]);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Function to check if a date has satellite data
  const hasDataForDate = (date) => {
    // Hard-coded dates from the user file
    const hardcodedDates = [
      "2025-01-15",
      "2025-01-10",
      "2024-05-13",
      "2022-08-22",
      "2025-02-16",
      "2025-03-19",
      "2025-04-04"
    ];
    
    const formattedDate = date.toISOString().split('T')[0];
    // Check against both passed dates and hardcoded dates
    return availableDates.includes(formattedDate) || hardcodedDates.includes(formattedDate);
  };

  const handleScroll = (direction) => {
    const dayJump = 4;
    const newIndex = Math.max(0, Math.min(dots.length - 21, currentIndex + (direction === 'left' ? -dayJump : dayJump)));
    setCurrentIndex(newIndex);
  };

  const getVisibleDates = () => {
    const visibleStartDate = new Date(startDate);
    visibleStartDate.setDate(startDate.getDate() + currentIndex);
    
    const visibleEndDate = new Date(startDate);
    visibleEndDate.setDate(startDate.getDate() + currentIndex + 20);
    
    return { visibleStartDate, visibleEndDate };
  };

  const getDotDate = (index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + currentIndex + index);
    return date;
  };

  const { visibleStartDate, visibleEndDate } = getVisibleDates();

  return (
    <TimelineContainer show={showTimeline}>
      <TimelineContent>
        <ScrollButton onClick={() => handleScroll('left')}>←</ScrollButton>
        <ScrollButton onClick={() => handleScroll('right')}>→</ScrollButton>
        <DateLabel>{formatDate(visibleStartDate)}</DateLabel>
        <TimelineLine />
        {dots.slice(currentIndex, currentIndex + 21).map((_, index) => {
          const dotDate = getDotDate(index);
          return (
            <Dot 
              key={`${currentIndex}-${index}`}
              className="entering"
              style={{ animationDelay: `${index * 0.02}s` }}
              hasData={hasDataForDate(dotDate)}
            >
              <HoverDate>{formatDate(dotDate)}</HoverDate>
            </Dot>
          );
        })}
        <TimelineLine />
        <DateLabel>{formatDate(visibleEndDate)}</DateLabel>
      </TimelineContent>
    </TimelineContainer>
  );
};

export default Timeline; 
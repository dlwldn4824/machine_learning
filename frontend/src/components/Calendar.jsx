import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import ScheduleModal from './ScheduleModal'
import './Calendar.css'

function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('month') // 'month' or 'week'
  const [schedules, setSchedules] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState(null)

  useEffect(() => {
    fetchSchedules()
    fetchCategories()
  }, [currentDate, viewMode])

  const fetchSchedules = async () => {
    let start, end
    if (viewMode === 'month') {
      start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    } else {
      const weekStart = startOfWeek(currentDate, { locale: ko })
      const weekEnd = endOfWeek(currentDate, { locale: ko })
      start = format(weekStart, 'yyyy-MM-dd')
      end = format(weekEnd, 'yyyy-MM-dd')
    }
    
    try {
      const response = await fetch(`/api/schedules?startDate=${start}&endDate=${end}`)
      const data = await response.json()
      setSchedules(data)
    } catch (error) {
      console.error('일정 조회 실패:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      setCategories(data)
    } catch (error) {
      console.error('카테고리 조회 실패:', error)
    }
  }

  // 통계 계산
  const completedSchedules = schedules.filter(s => s.is_adjustable === 0).length
  const totalSchedules = schedules.length

  let days = []
  let displayDate = currentDate

  if (viewMode === 'month') {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { locale: ko })
    const calendarEnd = endOfWeek(monthEnd, { locale: ko })
    days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
    displayDate = currentDate
  } else {
    // 주간 뷰
    const weekStart = startOfWeek(currentDate, { locale: ko })
    const weekEnd = endOfWeek(currentDate, { locale: ko })
    days = eachDayOfInterval({ start: weekStart, end: weekEnd })
    displayDate = weekStart
  }

  const getSchedulesForDate = (date) => {
    return schedules.filter(schedule => 
      isSameDay(new Date(schedule.start_date), date)
    )
  }

  const handleDateClick = (date) => {
    setSelectedDate(date)
    setSelectedSchedule(null)
    setShowModal(true)
  }

  const handleScheduleClick = (schedule, e) => {
    e.stopPropagation()
    setSelectedSchedule(schedule)
    setSelectedDate(new Date(schedule.start_date))
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setSelectedSchedule(null)
    setSelectedDate(null)
    fetchSchedules()
  }

  const handleDelete = async (id) => {
    if (!confirm('일정을 삭제하시겠습니까?')) return
    
    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      fetchSchedules()
      handleModalClose()
    } catch (error) {
      console.error('일정 삭제 실패:', error)
    }
  }

  const handlePrevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1))
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 7)
      setCurrentDate(newDate)
    }
  }

  const handleNextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1))
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 7)
      setCurrentDate(newDate)
    }
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header-wireframe">
        <div className="calendar-title-section">
          <h2>{format(displayDate, 'yyyy년 M월', { locale: ko })}</h2>
          <div className="calendar-stats">
            <span className="stat-item">✓</span>
            <span className="stat-number">{completedSchedules}</span>
            <span className="stat-emoji">😊</span>
            <span className="stat-heart">❤️</span>
            <span className="stat-heart">❤️</span>
          </div>
        </div>
        <div className="calendar-controls">
          <button className="nav-btn" onClick={handlePrevPeriod}>←</button>
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              월
            </button>
            <button 
              className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              주
            </button>
          </div>
          <button className="nav-btn" onClick={handleNextPeriod}>→</button>
        </div>
      </div>

      <div className="calendar-grid">
        <div className="calendar-weekdays">
          {['일', '월', '화', '수', '목', '금', '토'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        <div className="calendar-days">
          {days.map(day => {
            const daySchedules = getSchedulesForDate(day)
            const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true
            const isToday = isSameDay(day, new Date())
            
            return (
              <div
                key={day.toISOString()}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => handleDateClick(day)}
              >
                <div className="day-number">{format(day, 'd')}</div>
                <div className="day-schedules">
                  {daySchedules.slice(0, 3).map(schedule => (
                    <div
                      key={schedule.id}
                      className={`schedule-item ${schedule.is_adjustable === 0 ? 'completed' : ''}`}
                      style={{ backgroundColor: schedule.category_color || '#ccc' }}
                      onClick={(e) => handleScheduleClick(schedule, e)}
                      title={schedule.title}
                    >
                      {schedule.title}
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div className="schedule-more">+{daySchedules.length - 3}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && (
        <ScheduleModal
          date={selectedDate}
          schedule={selectedSchedule}
          categories={categories}
          onClose={handleModalClose}
          onDelete={handleDelete}
          onRefresh={fetchSchedules}
        />
      )}
    </div>
  )
}

export default Calendar

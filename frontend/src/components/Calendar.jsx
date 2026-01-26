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
  const [showAddForm, setShowAddForm] = useState(false)

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
    // 같은 날짜를 다시 클릭하면 닫기
    if (selectedDate && isSameDay(selectedDate, date)) {
      setSelectedDate(null)
      setShowAddForm(false)
    } else {
      setSelectedDate(date)
      setSelectedSchedule(null)
      setShowAddForm(false)
    }
  }

  const handleScheduleClick = (schedule, e) => {
    e.stopPropagation()
    setSelectedSchedule(schedule)
    setSelectedDate(new Date(schedule.start_date))
    setShowModal(true)
  }

  const handleScheduleItemClick = (schedule, e) => {
    e.stopPropagation()
    setSelectedSchedule(schedule)
    setShowModal(true)
  }

  const handleToggleSchedule = async (schedule, e) => {
    e.stopPropagation()
    // 일정 완료 상태 토글 (is_adjustable을 반대로)
    try {
      const updatedSchedule = {
        ...schedule,
        is_adjustable: schedule.is_adjustable === 1 ? 0 : 1
      }
      const response = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSchedule)
      })
      if (response.ok) {
        const data = await response.json()
        setSchedules(prev => prev.map(s => s.id === schedule.id ? data : s))
      }
    } catch (error) {
      console.error('일정 상태 변경 실패:', error)
    }
  }

  const handleModalClose = (newSchedule = null) => {
    setShowModal(false)
    setSelectedSchedule(null)
    setSelectedDate(null)
    
    // 새 일정이 전달되면 즉시 상태 업데이트
    if (newSchedule) {
      setSchedules(prev => {
        // 이미 존재하는 일정인지 확인 (수정인 경우)
        const existingIndex = prev.findIndex(s => s.id === newSchedule.id)
        if (existingIndex >= 0) {
          // 수정: 기존 일정 교체
          const updated = [...prev]
          updated[existingIndex] = newSchedule
          return updated
        } else {
          // 추가: 새 일정 추가
          return [...prev, newSchedule]
        }
      })
    }
    
    // 서버에서 최신 데이터 가져오기
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
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${selectedDate && isSameDay(selectedDate, day) ? 'selected' : ''}`}
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

      {/* 선택된 날짜의 일정 목록 */}
      {selectedDate && !showModal && (
        <div className="selected-date-schedules">
          <div className="selected-date-header">
            <h3>{format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}</h3>
            <button 
              className="close-date-btn"
              onClick={() => {
                setSelectedDate(null)
                setShowAddForm(false)
              }}
            >
              ×
            </button>
          </div>
          
          <div className="date-schedules-list">
            {getSchedulesForDate(selectedDate).length === 0 ? (
              <div className="empty-schedules">
                <p>이 날짜에 일정이 없습니다.</p>
              </div>
            ) : (
              getSchedulesForDate(selectedDate).map(schedule => (
                <div 
                  key={schedule.id} 
                  className="date-schedule-item"
                  onClick={(e) => handleScheduleItemClick(schedule, e)}
                >
                  <input
                    type="checkbox"
                    checked={schedule.is_adjustable === 0}
                    onChange={(e) => handleToggleSchedule(schedule, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="schedule-checkbox"
                  />
                  <div 
                    className="schedule-item-indicator"
                    style={{ backgroundColor: schedule.category_color || '#ccc' }}
                  />
                  <span className="schedule-item-title">{schedule.title}</span>
                  {schedule.description && (
                    <span className="schedule-item-desc">{schedule.description}</span>
                  )}
                  <button
                    className="schedule-item-menu"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleScheduleItemClick(schedule, e)
                    }}
                  >
                    ⋯
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="add-schedule-section">
            {showAddForm ? (
              <ScheduleModal
                date={selectedDate}
                schedule={null}
                categories={categories}
                onClose={(newSchedule) => {
                  setShowAddForm(false)
                  handleModalClose(newSchedule)
                }}
                onDelete={handleDelete}
                onRefresh={handleModalClose}
              />
            ) : (
              <button
                className="add-schedule-btn"
                onClick={() => setShowAddForm(true)}
              >
                + 일정 추가하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 일정 수정/삭제 모달 */}
      {showModal && selectedSchedule && (
        <ScheduleModal
          date={selectedDate}
          schedule={selectedSchedule}
          categories={categories}
          onClose={handleModalClose}
          onDelete={handleDelete}
          onRefresh={handleModalClose}
        />
      )}
    </div>
  )
}

export default Calendar

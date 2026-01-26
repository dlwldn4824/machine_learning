import { useState, useEffect } from 'react'
import './ScheduleMatching.css'

function ScheduleMatching({ roomId, chatRooms }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedRoom, setSelectedRoom] = useState(roomId || '')
  const [availability, setAvailability] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' or 'suggestions'

  useEffect(() => {
    // 기본 날짜 설정 (오늘부터 7일 후)
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    setStartDate(today.toISOString().split('T')[0])
    setEndDate(nextWeek.toISOString().split('T')[0])
  }, [])

  const handleCheckAvailability = async () => {
    if (!startDate || !endDate || !selectedRoom) {
      setError('기간과 채팅방을 선택해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setAvailability(null)

    try {
      const response = await fetch('/api/schedule-matching/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          roomId: parseInt(selectedRoom)
        })
      })

      const data = await response.json()
      setAvailability(data)
      setViewMode('calendar')
    } catch (error) {
      console.error('가용성 조회 오류:', error)
      setError('가용성 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleGetSuggestions = async () => {
    if (!startDate || !endDate || !selectedRoom) {
      setError('기간과 채팅방을 선택해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setSuggestions([])

    try {
      const response = await fetch('/api/schedule-matching/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          roomId: parseInt(selectedRoom),
          duration: 60 // 1시간 단위
        })
      })

      const data = await response.json()
      setSuggestions(data.suggestions || [])
      setViewMode('suggestions')
    } catch (error) {
      console.error('일정 제안 오류:', error)
      setError('일정 제안 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getAvailabilityColor = (status) => {
    switch (status) {
      case 'available':
        return '#10b981' // 초록색 - 일정 없음
      case 'adjustable':
        return '#f59e0b' // 주황색 - 조정 가능
      case 'fixed':
        return '#ef4444' // 빨간색 - 조정 불가능
      default:
        return '#e0e0e0' // 회색
    }
  }

  const getAvailabilityLabel = (status) => {
    switch (status) {
      case 'available':
        return '일정 없음'
      case 'adjustable':
        return '조정 가능'
      case 'fixed':
        return '조정 불가능'
      default:
        return '알 수 없음'
    }
  }

  // 시간대별 그리드 생성
  const generateTimeGrid = () => {
    if (!availability) return []

    const grid = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    const current = new Date(start)

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      const daySlots = []

      // 하루를 시간대별로 나눔 (예: 0시부터 23시까지)
      for (let hour = 0; hour < 24; hour++) {
        const slotKey = `${dateStr}_${hour}`
        const userStatuses = {}

        availability.users.forEach(user => {
          userStatuses[user.userName] = user.availability[slotKey] || 'available'
        })

        daySlots.push({
          hour,
          slotKey,
          userStatuses
        })
      }

      grid.push({
        date: new Date(current),
        dateStr,
        slots: daySlots
      })

      current.setDate(current.getDate() + 1)
    }

    return grid
  }

  const timeGrid = generateTimeGrid()

  return (
    <div className="schedule-matching-container">
      <div className="matching-header">
        <h2>📅 일정 맞추기</h2>
        <p>팀원들의 일정을 비교하여 최적의 시간을 찾아보세요</p>
      </div>

      <div className="matching-controls">
        <div className="control-group">
          <label>채팅방 선택</label>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
          >
            <option value="">채팅방 선택</option>
            {chatRooms.map(room => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>시작 날짜</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="control-group">
          <label>종료 날짜</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="control-actions">
          <button
            onClick={handleCheckAvailability}
            disabled={loading}
            className="btn-primary"
          >
            가용성 확인
          </button>
          <button
            onClick={handleGetSuggestions}
            disabled={loading}
            className="btn-suggest"
          >
            최적 일정 제안
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* 범례 */}
      {(availability || suggestions.length > 0) && (
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#10b981' }}></div>
            <span>일정 없음</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
            <span>조정 가능</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ef4444' }}></div>
            <span>조정 불가능</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading">분석 중...</div>
      )}

      {/* 가용성 캘린더 뷰 */}
      {availability && viewMode === 'calendar' && (
        <div className="availability-calendar">
          <h3>팀원별 가용성 (개인정보 보호)</h3>
          <div className="calendar-grid">
            {timeGrid.map((day, dayIndex) => (
              <div key={dayIndex} className="day-column">
                <div className="day-header">
                  {day.date.toLocaleDateString('ko-KR', { 
                    month: 'short', 
                    day: 'numeric',
                    weekday: 'short'
                  })}
                </div>
                <div className="time-slots">
                  {day.slots.map((slot, slotIndex) => {
                    // 각 시간대별로 팀원들의 상태 집계
                    const statusCounts = {
                      available: 0,
                      adjustable: 0,
                      fixed: 0
                    }

                    Object.values(slot.userStatuses).forEach(status => {
                      statusCounts[status] = (statusCounts[status] || 0) + 1
                    })

                    // 가장 많은 상태를 대표 색상으로 표시
                    const dominantStatus = Object.entries(statusCounts)
                      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'available'

                    return (
                      <div
                        key={slotIndex}
                        className="time-slot"
                        style={{
                          backgroundColor: getAvailabilityColor(dominantStatus),
                          opacity: 0.7
                        }}
                        title={`${slot.hour}시 - ${statusCounts.available}명 가능, ${statusCounts.adjustable}명 조정가능, ${statusCounts.fixed}명 불가능`}
                      >
                        {slot.hour}시
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 팀원별 요약 */}
          <div className="users-summary">
            <h4>팀원별 요약</h4>
            {availability.users.map((user, index) => {
              const statusCounts = {
                available: 0,
                adjustable: 0,
                fixed: 0
              }

              Object.values(user.availability).forEach(status => {
                statusCounts[status] = (statusCounts[status] || 0) + 1
              })

              return (
                <div key={index} className="user-summary">
                  <div className="user-name">{user.userName}</div>
                  <div className="user-status-bars">
                    <div className="status-bar">
                      <span>가능:</span>
                      <div className="bar">
                        <div
                          className="bar-fill available"
                          style={{ width: `${(statusCounts.available / Object.keys(user.availability).length) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="status-bar">
                      <span>조정가능:</span>
                      <div className="bar">
                        <div
                          className="bar-fill adjustable"
                          style={{ width: `${(statusCounts.adjustable / Object.keys(user.availability).length) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="status-bar">
                      <span>불가능:</span>
                      <div className="bar">
                        <div
                          className="bar-fill fixed"
                          style={{ width: `${(statusCounts.fixed / Object.keys(user.availability).length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 최적 일정 제안 */}
      {suggestions.length > 0 && viewMode === 'suggestions' && (
        <div className="suggestions-list">
          <h3>✨ 추천 일정 (리스크 낮은 순)</h3>
          {suggestions.map((suggestion, index) => {
            const start = new Date(suggestion.start)
            const end = new Date(suggestion.end)

            return (
              <div key={index} className="suggestion-card">
                <div className="suggestion-header">
                  <div className="suggestion-time">
                    <strong>
                      {start.toLocaleDateString('ko-KR', { 
                        month: 'short', 
                        day: 'numeric',
                        weekday: 'short'
                      })}
                    </strong>
                    <span>
                      {start.toLocaleTimeString('ko-KR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })} - {end.toLocaleTimeString('ko-KR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <div className="suggestion-score">
                    <span className="risk-badge">리스크: {suggestion.riskScore}</span>
                    <span className="participation-badge">
                      참여율: {Math.round(suggestion.participationRate * 100)}%
                    </span>
                  </div>
                </div>
                <div className="suggestion-stats">
                  <span>✅ 가능: {suggestion.availableCount}명</span>
                  <span>🟡 조정가능: {suggestion.adjustableCount}명</span>
                  <span>🔴 불가능: {suggestion.fixedCount}명</span>
                </div>
                <div className="suggestion-users">
                  {Object.entries(suggestion.userStatuses).map(([userName, status]) => (
                    <span
                      key={userName}
                      className="user-status-tag"
                      style={{ backgroundColor: getAvailabilityColor(status) }}
                    >
                      {userName}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ScheduleMatching
